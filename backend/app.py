from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import openai
import json
import asyncio
import os
from typing import List, Dict, Any
from pydantic import BaseModel
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Your React app's address
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 환경 변수에서 API 키 가져오기
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

client = openai.Client(api_key=openai_api_key)

# Define a model for the message format
class ChatMessage(BaseModel):
    role: str
    content: str

# Define a model for the request body
class ChatRequest(BaseModel):
    messages: List[ChatMessage]

# Define model for title generation request
class TitleRequest(BaseModel):
    userMessage: str
    aiResponse: str

@app.post("/chat")
async def chat(request: Request) -> StreamingResponse:
    # Parse the request body
    chat_request_data = await request.json()
    messages = chat_request_data.get("messages", [])
    
    async def stream_openai_response():
        try:
            # Add system message if not present
            if not any(msg["role"] == "system" for msg in messages):
                messages.insert(0, {"role": "system", "content": "You are a helpful assistant."})
            
            stream = client.chat.completions.create(
                messages=messages,
                model="gpt-3.5-turbo",
                stream=True,
            )

            for chunk in stream:
                # Check if client disconnected
                if await request.is_disconnected():
                    print("Client disconnected, stopping LLM generation")
                    break
                
                content = chunk.choices[0].delta.content or ""
                if content:
                    data = json.dumps({"status": "processing", "data": content}, ensure_ascii=False)
                    yield f"data: {data}\n\n"
                    await asyncio.sleep(0.01)
            
            if not await request.is_disconnected():
                yield f"data: {json.dumps({'status': 'complete', 'data': 'Stream finished'}, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            error_data = json.dumps({"status": "error", "data": str(e)}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        stream_openai_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )

@app.post("/generate-title")
async def generate_title(request: TitleRequest):
    try:
        messages = [
            {"role": "system", "content": "You are a helpful assistant that creates concise, descriptive titles."},
            {"role": "user", "content": f"Create a short, descriptive title (maximum 5 words) for a conversation that starts with this user message: '{request.userMessage}' and your first response begins with: '{request.aiResponse[:100]}...'"}
        ]
        
        response = client.chat.completions.create(
            messages=messages,
            model="gpt-3.5-turbo",
            max_tokens=20,
            temperature=0.7
        )
        
        title = response.choices[0].message.content.strip().replace('"', '')
        # Remove quotes if the model adds them
        if title.startswith('"') and title.endswith('"'):
            title = title[1:-1]
            
        return {"title": title}
    except Exception as e:
        print(f"Error generating title: {str(e)}")
        # Fallback to using the first few words of user message
        words = request.userMessage.split()
        fallback_title = " ".join(words[:5]) + ("..." if len(words) > 5 else "")
        return {"title": fallback_title}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)