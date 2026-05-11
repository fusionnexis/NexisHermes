"""M7: Agent Execution Engine — scheduler, worker pool, health monitoring.

All workers are Hermes Agent subprocesses. The scheduler is a daemon thread
that periodically dispatches ready tasks, enforces timeouts, and reclaims
stale sessions.
"""

import logging
import threading
import time

logger = logging.getLogger(__name__)

_scheduler_instance = None
_scheduler_lock = threading.Lock()


class ExecutionScheduler:
    """Persistent execution scheduler daemon thread."""

    def __init__(self, interval: float = 5.0, max_concurrent: int = 4):
        self.interval = interval
        self.max_concurrent = max_concurrent
        self._thread = None
        self._stop_event = threading.Event()
        self._started_at = None

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._started_at = time.time()
        self._thread = threading.Thread(target=self._loop, daemon=True, name="ExecutionScheduler")
        self._thread.start()
        logger.info("ExecutionScheduler started (interval=%.1fs, max_concurrent=%d)",
                    self.interval, self.max_concurrent)

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=self.interval * 2)
        logger.info("ExecutionScheduler stopped")

    @property
    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    @property
    def uptime_seconds(self) -> float:
        if self._started_at:
            return time.time() - self._started_at
        return 0.0

    def _loop(self):
        while not self._stop_event.is_set():
            try:
                self._tick()
            except Exception as exc:
                logger.debug("ExecutionScheduler tick error: %s", exc)
            self._stop_event.wait(timeout=self.interval)

    def _tick(self):
        """One scheduler cycle: dispatch + timeout check + stale reclaim."""
        try:
            from hermes_cli import kanban_db as kb
            kb.init_db()
        except ImportError:
            return

        # Count active workers (running tasks)
        try:
            conn = kb.connect()
            rows = conn.execute(
                "SELECT COUNT(*) as n FROM tasks WHERE status = 'running'"
            ).fetchone()
            active = int(rows["n"] or 0) if rows else 0
        except Exception:
            return
        finally:
            try:
                conn.close()
            except Exception:
                pass

        # Dispatch if slots available
        if active < self.max_concurrent:
            try:
                conn = kb.connect()
                if hasattr(kb, "dispatch_once"):
                    kb.dispatch_once(conn, max_spawn=self.max_concurrent - active)
                conn.close()
            except Exception as exc:
                logger.debug("Scheduler dispatch error: %s", exc)

        # Timeout enforcement
        self._enforce_timeouts()

        # Stale task reclaim
        self._reclaim_stale()

    def _enforce_timeouts(self):
        """Kill tasks that exceeded max_runtime_seconds."""
        try:
            from hermes_cli import kanban_db as kb
            conn = kb.connect()
            now = int(time.time())
            rows = conn.execute(
                "SELECT id, started_at, max_runtime_seconds FROM tasks "
                "WHERE status = 'running' AND max_runtime_seconds IS NOT NULL AND started_at IS NOT NULL"
            ).fetchall()
            for row in rows:
                started = int(row["started_at"] or 0)
                max_rt = int(row["max_runtime_seconds"] or 0)
                if max_rt > 0 and started > 0 and (now - started) > max_rt:
                    conn.execute("UPDATE tasks SET status = 'blocked' WHERE id = ?", (row["id"],))
                    if hasattr(kb, "add_comment"):
                        kb.add_comment(conn, row["id"], "system",
                                       f"Execution timeout exceeded ({max_rt}s)")
                    logger.info("Task %s timed out after %ds", row["id"], now - started)
            conn.close()
        except Exception as exc:
            logger.debug("Timeout enforcement error: %s", exc)

    def _reclaim_stale(self):
        """Reclaim tasks with expired claim_expires."""
        try:
            from hermes_cli import kanban_db as kb
            conn = kb.connect()
            now = int(time.time())
            rows = conn.execute(
                "SELECT id FROM tasks WHERE status = 'running' AND claim_expires IS NOT NULL "
                "AND claim_expires < ?", (now,)
            ).fetchall()
            for row in rows:
                conn.execute("UPDATE tasks SET status = 'ready', claim_lock = NULL, "
                             "claim_expires = NULL, worker_pid = NULL WHERE id = ?", (row["id"],))
                logger.info("Reclaimed stale task %s", row["id"])
            conn.close()
        except Exception as exc:
            logger.debug("Stale reclaim error: %s", exc)


def get_execution_status() -> dict:
    """Return execution engine status for /api/execution/status."""
    global _scheduler_instance
    enabled = _scheduler_instance is not None and _scheduler_instance.is_running

    result = {
        "enabled": enabled,
        "active_workers": 0,
        "max_concurrent": 4,
        "queue_depth": 0,
        "scheduler_interval": 5.0,
        "uptime_seconds": 0.0,
    }

    if _scheduler_instance:
        result["max_concurrent"] = _scheduler_instance.max_concurrent
        result["scheduler_interval"] = _scheduler_instance.interval
        result["uptime_seconds"] = _scheduler_instance.uptime_seconds

    # Count active workers and queue depth
    try:
        from hermes_cli import kanban_db as kb
        kb.init_db()
        conn = kb.connect()
        running = conn.execute("SELECT COUNT(*) as n FROM tasks WHERE status = 'running'").fetchone()
        ready = conn.execute("SELECT COUNT(*) as n FROM tasks WHERE status = 'ready'").fetchone()
        result["active_workers"] = int(running["n"] or 0) if running else 0
        result["queue_depth"] = int(ready["n"] or 0) if ready else 0
        conn.close()
    except Exception:
        pass

    return result


def start_scheduler_if_enabled():
    """Start the execution scheduler if config.yaml has execution.enabled=true."""
    global _scheduler_instance
    try:
        from api.config import get_config
        cfg = get_config()
        exec_cfg = cfg.get("execution") or {}
        if not exec_cfg.get("enabled", False):
            return
        interval = float(exec_cfg.get("scheduler_interval", 5.0))
        max_concurrent = int(exec_cfg.get("max_concurrent", 4))
        with _scheduler_lock:
            if _scheduler_instance is None:
                _scheduler_instance = ExecutionScheduler(interval=interval, max_concurrent=max_concurrent)
                _scheduler_instance.start()
    except Exception as exc:
        logger.debug("Failed to start execution scheduler: %s", exc)
