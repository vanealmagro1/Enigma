"""Servidor FastAPI: recibe datos del celular y llama a la Bombe."""

from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def root():
    return {"status": "ok"}
