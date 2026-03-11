# Spring Boot API image build template.
# Assumes a Maven-based backend under Backend/.

FROM maven:3.9.9-eclipse-temurin-21 AS builder
WORKDIR /app

COPY pom.xml ./
COPY mvnw ./
COPY .mvn ./.mvn
RUN chmod +x mvnw || true
RUN if [ -f ./mvnw ]; then ./mvnw -q -DskipTests dependency:go-offline; else mvn -q -DskipTests dependency:go-offline; fi

COPY src ./src
RUN if [ -f ./mvnw ]; then ./mvnw -q -DskipTests package; else mvn -q -DskipTests package; fi

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
