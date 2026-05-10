"""Hermes Web UI -- Git worktree CRUD operations.

Provides create/list/remove operations for git worktrees, enabling
isolated workspace directories for concurrent agent execution.
Uses subprocess.run for git CLI operations, following the pattern
in api/workspace.py (_run_git helper).
"""

import logging
import subprocess
import time
from pathlib import Path

logger = logging.getLogger(__name__)


def _run_git_worktree(args: list[str], cwd: str | Path, timeout: int = 10) -> str | None:
    """Run a git worktree command and return stdout, or None on failure."""
    try:
        r = subprocess.run(
            ['git'] + args, cwd=str(cwd), capture_output=True,
            text=True, timeout=timeout,
        )
        if r.returncode == 0:
            return r.stdout.strip()
        logger.debug("git worktree command failed: git %s → rc=%d stderr=%s",
                     ' '.join(args), r.returncode, r.stderr.strip())
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as exc:
        logger.debug("git worktree command error: %s", exc)
        return None


def _is_git_repo(workspace: Path) -> bool:
    """Check if the workspace directory is a git repository."""
    return (workspace / '.git').exists()


def _git_available(workspace: Path) -> bool:
    """Check if git CLI is available on the host."""
    try:
        subprocess.run(
            ['git', '--version'], capture_output=True, text=True, timeout=3,
        )
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


def create_worktree(
    workspace: Path,
    branch_name: str | None = None,
    base_ref: str | None = None,
) -> dict | None:
    """Create a git worktree with an isolated branch.

    Returns {worktree_id, path, branch} on success, None on failure.
    """
    if not _git_available(workspace):
        return None
    if not _is_git_repo(workspace):
        return None

    if not branch_name:
        branch_name = f"wt-{int(time.time())}"

    if not base_ref:
        base_ref = 'HEAD'

    # Worktrees live in a sibling directory next to the workspace,
    # not inside it — avoids nested .git structures and path confusion.
    wt_dir = workspace.parent / f"{workspace.name}-{branch_name}"

    # Create a new branch + worktree
    result = _run_git_worktree(
        ['worktree', 'add', '-b', branch_name, str(wt_dir), base_ref],
        cwd=workspace,
    )
    if result is None:
        return None

    wt_path = wt_dir
    return {
        'worktree_id': branch_name,
        'path': str(wt_path),
        'branch': branch_name,
    }


def list_worktrees(workspace: Path) -> list[dict] | None:
    """List all git worktrees for a workspace.

    Returns array of {worktree_id, path, branch, is_locked} on success,
    None on failure.
    """
    if not _git_available(workspace):
        return None
    if not _is_git_repo(workspace):
        return None

    output = _run_git_worktree(['worktree', 'list', '--porcelain'], cwd=workspace)
    if output is None:
        return None

    worktrees = []
    entries = output.split('\n\n')
    for entry in entries:
        if not entry.strip():
            continue
        fields = {}
        for line in entry.strip().splitlines():
            if ' ' in line:
                key, value = line.split(' ', 1)
                fields[key] = value
            elif line == 'locked':
                fields['locked'] = True
            elif line == 'prunable':
                fields['prunable'] = True

        path = fields.get('worktree', '')
        branch_raw = fields.get('branch', '')

        # Extract human-readable branch name from refs/heads/xxx
        if branch_raw.startswith('refs/heads/'):
            branch = branch_raw[len('refs/heads/'):]
        else:
            branch = branch_raw

        # Use the branch name as worktree_id (matches create_worktree pattern)
        wt_id = branch

        worktrees.append({
            'worktree_id': wt_id,
            'path': path,
            'branch': branch,
            'is_locked': bool(fields.get('locked', False)),
        })

    return worktrees


def remove_worktree(workspace: Path, worktree_id: str) -> dict | None:
    """Remove a git worktree and its associated branch.

    Returns {removed: true, worktree_id} on success, None on failure.
    """
    if not _git_available(workspace):
        return None
    if not _is_git_repo(workspace):
        return None

    # Resolve worktree path from worktree_id
    wt_path = workspace / worktree_id
    if not wt_path.exists():
        # Try matching by basename in the worktree list
        wts = list_worktrees(workspace)
        if wts:
            for wt in wts:
                if wt['worktree_id'] == worktree_id or wt['branch'] == worktree_id:
                    wt_path = Path(wt['path'])
                    break
        if not wt_path.exists():
            return None

    # Remove the worktree (force to handle uncommitted changes)
    result = _run_git_worktree(
        ['worktree', 'remove', '--force', str(wt_path)],
        cwd=workspace,
    )
    if result is None:
        return None

    # Optionally delete the associated branch
    branch_name = worktree_id
    _run_git_worktree(['branch', '-D', branch_name], cwd=workspace)

    return {
        'removed': True,
        'worktree_id': worktree_id,
    }