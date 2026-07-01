# ── Stage 1: Build Angular frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Spring Boot JAR (with frontend baked in) ──────────────────
FROM maven:3.9-eclipse-temurin-21 AS backend-build
WORKDIR /app/backend
COPY backend/pom.xml ./
RUN mvn dependency:go-offline -B
COPY backend/src ./src
# Inject the built Angular app as Spring Boot static resources
COPY --from=frontend-build /app/frontend/dist/frontend/browser ./src/main/resources/static/
RUN mvn package -DskipTests

# ── Stage 3: Slim runtime image ───────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=backend-build /app/backend/target/expense-tracker-backend-1.0.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-Xmx400m", "-Xms256m", "-jar", "app.jar"]
