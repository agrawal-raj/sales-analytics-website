from pydantic import BaseModel



class User(BaseModel):
    username: str
    role: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role:str

class Transaction(BaseModel):
    customer_name: str
    amount: float
    date: str
