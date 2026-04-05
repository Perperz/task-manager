from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient = None
db = None

# Collection references
users_collection = None
tasks_collection = None


async def connect_db():
    """Open the MongoDB connection and set up collection references."""
    global client, db, users_collection, tasks_collection

    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    users_collection = db["users"]
    tasks_collection = db["tasks"]

    # Create indexes for common queries
    await users_collection.create_index("email", unique=True)
    await users_collection.create_index("username", unique=True)
    await tasks_collection.create_index("created_by")
    await tasks_collection.create_index("status")

    print(f"Connected to MongoDB: {settings.DATABASE_NAME}")


async def close_db():
    """Close the MongoDB connection."""
    global client
    if client:
        client.close()
        print("MongoDB connection closed.")