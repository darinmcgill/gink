""" contains the Muid class (basically a way to represent global addresses) """
from typing import NamedTuple, Any, Union
from uuid import UUID

from muid_pb2 import Muid as MuidBuilder

from .dummy import Dummy

class Muid(NamedTuple):
    """ Defines a global address of an object in the Gink system. """
    timestamp: int
    medallion: int
    offset: int

    _TIMESTAMP_MOD = 16 ** 14
    _MEDALLION_MOD = 16 ** 13
    _OFFSET_MOD = 16 ** 5

    def __repr__(self):
        return f"Muid({self.timestamp}, {self.medallion}, {self.offset})"

    def __bytes__(self):
        # There's probably a better way to do this...
        return UUID(str(self)).bytes

    def __str__(self):
        """ Translates to a format that looks like: 05D5EAC793E61F-1F8CB77AE1EAA-0000B

        See docs/muid.md for a description of the format. """
        time_part = hex(self.timestamp % Muid._TIMESTAMP_MOD)[2:].upper().zfill(14)
        medallion_part = hex(self.medallion % Muid._MEDALLION_MOD)[2:].upper().zfill(13)
        offset_part = hex(self.offset % Muid._OFFSET_MOD)[2:].upper().zfill(5)

        result = f"{time_part}-{medallion_part}-{offset_part}"

        assert len(result) == 34, len(result)
        return result

    def get_inverse(self):
        """ Returns a Muid with each component inverted.

            Used for reverse sorting.
        """
        return Muid(
            timestamp=~int(self.timestamp),
            medallion=~self.medallion,
            offset=~self.offset)

    def put_into(self, builder: MuidBuilder):
        """ Puts the data from this muid into the builder. """
        builder.offset = self.offset # type: ignore
        builder.timestamp = self.timestamp if self.timestamp else 0 # type: ignore
        builder.medallion= self.medallion if self.medallion else 0 # type: ignore

    @classmethod
    def create(cls, builder: Union[MuidBuilder, Dummy] = Dummy(), context: Any=Dummy(), offset=None):
        """ Creates a muid from a builder and optionally a change_set_info context object. """
        timestamp = builder.timestamp or context.timestamp  # type: ignore
        medallion = builder.medallion or context.medallion  # type: ignore
        offset = offset or builder.offset # type: ignore
        assert offset, "no offset"
        assert medallion, "no medallion"
        assert timestamp, "no timestamp"
        return cls(timestamp, medallion, offset)

    @classmethod
    def from_bytes(cls, data: bytes):
        """ does the inverse of bytes(muid) """
        # there's probably a more efficient way to do this
        assert len(data) >= 16
        hexed = data.hex()
        time_part = int(hexed[0:14], 16)
        medl_part = int(hexed[14:27], 16)
        off_part = int(hexed[27:32], 16)
        return Muid(
            timestamp=time_part - Muid._TIMESTAMP_MOD * (time_part > (Muid._TIMESTAMP_MOD >> 1)),
            medallion=medl_part - Muid._MEDALLION_MOD * (medl_part > (Muid._MEDALLION_MOD >> 1)),
            offset=off_part - Muid._OFFSET_MOD * (off_part > (Muid._OFFSET_MOD >> 1)))
