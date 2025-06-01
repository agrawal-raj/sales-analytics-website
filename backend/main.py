from fastapi import FastAPI, HTTPException, Depends, Query, status, UploadFile, File, Request
from fastapi.security import  OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from datetime import datetime, timedelta
import csv
from logger import logger
from . import auth, schemas, database
from fastapi.responses import RedirectResponse

# # Initialize FastAPI
app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://192.168.1.40:5500"],  # Your frontend origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods including OPTIONS
    allow_headers=["*"],  # Allows all headers including Authorization
    expose_headers=["*"]
)

# 'http://192.168.1.40:5500'

# Routes
@app.post("/register", response_model=schemas.User)
async def register(user: schemas.UserCreate):
    logger.info(f"Attempting to register user: {user.username}")

    if auth.get_user(user.username):
        logger.warning(f"Registration failed: Username '{user.username}' already exists.")
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    
    try:
        database.cursor.execute(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            (user.username, hashed_password, user.role)
        )
        database.conn.commit()
        logger.info(f"User '{user.username}' successfully registered.")
    except Exception as e:
        logger.error(f"Database error during registration for '{user.username}': {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

    return {"username": user.username, "role": user.role}

@app.post("/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    logger.info(f"Login attempt for username: {form_data.username}")

    user = auth.authenticate_user(form_data.username, form_data.password)
    if not user:
        logger.warning(f"Login failed for user: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user["username"], "role": user["role"]},
        expires_delta=access_token_expires
    )

    logger.info(f"User '{form_data.username}' logged in successfully.")
    return {"access_token": access_token, "token_type": "bearer","role": user["role"]}

@app.get("/profile", response_model=schemas.User)
async def read_profile(current_user: dict = Depends(auth.get_current_user)):
    return {"username": current_user["username"], "role": current_user["role"]}

@app.post("/upload-sales")
async def upload_transactions(
    file: UploadFile = File(...),
    admin_user: dict = Depends(auth.get_current_admin_user)
):
    logger.info(f"Admin user '{admin_user['username']}' accessed /upload-sales")

    # Only allow admin users to upload transactions
    if admin_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can upload sales data"
        )

    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    try:
        # Read and parse CSV
        contents = await file.read()
        decoded = contents.decode('utf-8').splitlines()
        reader = csv.DictReader(decoded)
        
        # Validate CSV structure
        required_fields = ['customer_name', 'amount', 'date']
        if not all(field in reader.fieldnames for field in required_fields):
            raise HTTPException(
                status_code=400,
                detail=f"CSV must contain columns: {', '.join(required_fields)}"
            )
        
        # Process transactions
        transactions = []
        for row_num, row in enumerate(reader, 1):
            try:
                # Validate data
                datetime.strptime(row['date'], '%Y-%m-%d')
                amount = float(row['amount'])
                
                transactions.append((
                    row['customer_name'],
                    amount,
                    row['date'],
                    admin_user["username"]
                ))
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid data in row {row_num}: {str(e)}"
                )
        
        # Insert transactions
        database.cursor.executemany(
            """INSERT INTO transactions 
              (customer_name, amount, date, uploaded_by) 
              VALUES (?, ?, ?, ?)""",
            transactions
        )
        database.conn.commit()
        
        logger.info(f"User {admin_user['username']} uploaded {len(transactions)} transactions")
        return {"message": f"Successfully processed {len(transactions)} transactions"}
    
    except Exception as e:
        logger.error(f"Error processing transactions file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )

@app.get("/analytics/summary")
async def get_summary(admin_user: dict = Depends(auth.get_current_admin_user)):
    logger.info(f"Admin user {admin_user['username']} accessed summary analytics")
    
    try:
        database.cursor.execute("SELECT SUM(amount), COUNT(*), AVG(amount) FROM transactions")
        result = database.cursor.fetchone()
        
        logger.debug(f"Summary analytics query result: {result}")
        
        # Handle case where there are no transactions
        if result[0] is None:  # SUM(amount) will be NULL if no rows exist
            response = {
                "totalSales": 0.00,
                "totalTransactions": 0,
                "averageOrderValue": 0.00,
                "message": "No transaction data available"
            }
        else:
            response = {
                "totalSales": round(result[0], 2),
                "totalTransactions": result[1],
                "averageOrderValue": round(result[2], 2)
            }
        
        logger.info(f"Successfully returned summary analytics: {response}")
        return response
        
    except Exception as e:
        logger.error(f"Error in summary analytics: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching summary analytics")

@app.get("/analytics/top-customers")
def get_top_customers(admin_user: dict = Depends(auth.get_current_admin_user)):
    logger.info(f"Admin user {admin_user['username']} accessed top customers analytics")
    
    try:
        cursor = database.conn.cursor()
        cursor.execute("""
            SELECT customer_name, SUM(amount) as total_sales
            FROM transactions
            GROUP BY customer_name
            ORDER BY total_sales DESC
            LIMIT 3
        """)
        result = cursor.fetchall()
        
        logger.debug(f"Top customers query result: {result}")
        
        response = [
            {"customer_name": row[0], "total_sales": round(row[1], 2)}
            for row in result
        ]
        
        logger.info(f"Successfully returned top customers: {response}")
        return response
        
    except Exception as e:
        logger.error(f"Error in top customers analytics: {str(e)}", exc_info=True)
        raise

@app.get("/analytics/by-date")
def analytics_by_date(from_date: str = Query(..., alias="from"), 
                    to_date: str = Query(..., alias="to"),
                    admin_user: dict = Depends(auth.get_current_admin_user)):
    logger.info(f"Admin user {admin_user['username']} accessed date range analytics from {from_date} to {to_date}")
    
    try:
        query = """
            SELECT COUNT(*) as total_transactions,
                COALESCE(SUM(amount), 0) as total_sales,
                COALESCE(AVG(amount), 0) as average_order_value
            FROM transactions
            WHERE date BETWEEN ? AND ?
        """
        database.cursor.execute(query, (from_date, to_date))
        result = database.cursor.fetchone()
        
        logger.debug(f"Date range analytics query result: {result}")
        
        response = {
            "totalTransactions": result[0],
            "totalSales": round(result[1], 2),
            "averageOrderValue": round(result[2], 2)
        }
        
        logger.info(f"Successfully returned date range analytics: {response}")
        return response
        
    except Exception as e:
        logger.error(f"Error in date range analytics: {str(e)}", exc_info=True)
        raise

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    protected_routes = ['/profile.html', '/admin.html', '/landing.html']
    if any(request.url.path.endswith(route) for route in protected_routes):
        token = request.cookies.get("access_token") or request.headers.get("authorization", "").replace("Bearer", "")
        if not token:
            return RedirectResponse(url='/frontend/index.html?error=unauthorized')
        
        try:
            jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        except JWTError:
            return RedirectResponse(url='/frontend/index.html?error=invalid_token')
    
    return await call_next(request)

@app.post("/api/verify-token")
async def verify_token(request: Request):
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        token = auth_header.split(' ')[1]
        jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        return {"valid": True}
    except (JWTError, IndexError) as e:
        raise HTTPException(status_code=401, detail="Invalid token")




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)