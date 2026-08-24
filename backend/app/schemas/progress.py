from pydantic import BaseModel


class ProgressUpdate(BaseModel):
    completed: bool = True


class ProgressRead(BaseModel):
    module_id: int
    completed: bool
