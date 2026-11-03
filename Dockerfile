# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore dependencies
COPY ["AIStudio.Api/AIStudio.Api.csproj", "AIStudio.Api/"]
RUN dotnet restore "AIStudio.Api/AIStudio.Api.csproj"

# Copy full API source and publish
COPY AIStudio.Api/ AIStudio.Api/
WORKDIR "/src/AIStudio.Api"
RUN dotnet publish "AIStudio.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "AIStudio.Api.dll"]
