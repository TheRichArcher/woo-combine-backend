FROM python:3.11-slim

WORKDIR /app

COPY . .

RUN pip install alembic==1.10.4 sqlalchemy psycopg2-binary

CMD ["alembic", "revision", "--autogenerate", "-m", "Minimal test migration"] 