""" Various types classes for use throughout the codebase. """
from typing import NewType, Union
from datetime import datetime

Medallion = NewType('Medallion', int)
MuTimestamp = int
Offset = NewType('Offset', int)
GenericTimestamp = Union[datetime, int, float, None]
UserKey = Union[str, int]
UserValue = Union[str, int, float, datetime, bytes, bool, list, tuple, dict, None]
EPOCH = 0