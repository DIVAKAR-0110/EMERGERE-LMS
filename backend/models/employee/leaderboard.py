"""
Pydantic models for Leaderboard Snapshot and Ranking.
Matches frontend/src/pages/employee/LeaderBoard.jsx.
Strictly aligned with dbo.lms_leaderboard_snapshots schema.
"""

from typing import Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel


class LeaderboardSnapshotResponse(BaseModel):
    id: int
    employee_id: str
    total_learning_minutes: Optional[int] = None
    total_points: Optional[int] = None
    rank_position: Optional[int] = None
    percentile: Optional[Decimal] = None
    updated_at: Optional[datetime] = None

