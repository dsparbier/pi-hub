# pi-hub-agent — FastAPI sidecar (host metrics + read-only container view).
# glibc base so psutil's arm64 wheels install without a build toolchain.
FROM python:3.12-slim-bookworm

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# copy the package into /app/agent so `uvicorn agent.app:app` resolves
COPY . ./agent/

USER 10001:10001

EXPOSE 8080
CMD ["uvicorn", "agent.app:app", "--host", "0.0.0.0", "--port", "8080", "--no-server-header"]
