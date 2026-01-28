# EuFMD Nexus - Copilot Instructions

## Architecture Overview

**Stack**: React (Frontend) + FastAPI (Backend) + MySQL (Multi-database)

This is a veterinary disease management system with a **modular router-based architecture**. Key distinguishing features:
```
- **Multi-database setup**: Main database (`db_manager`) + secondary databases (`PCP`, `RMT`, `db_training`) using separate SQLAlchemy engines
- **Feature modules**: Each feature (RMT, PCP, Training, RISPLanding, etc.) has a dedicated router in `backend/routers/` that handles all related endpoints
- **Frontend feature-driven**: Frontend pages and services are organized by feature (RMT/, PCP/, RISP/) rather than by type
```
## Backend (Python/FastAPI)

### File Structure Patterns
```
- **`backend/main.py`**: Central app definition - imports all routers and configures CORS/middleware. Keep this lightweight
- **`backend/routers/*.py`**: Feature modules. Each router:
  - Defines its prefix (e.g., `prefix="/api/rmt"`)
  - Imports raw database queries via `DatabaseHelper` for direct SQL execution
  - Uses Pydantic models from `models.py` for request/response validation
  - Examples: `rmt.py`, `pcp.py`, `fast_report.py`, `thrace.py`
```
### Critical Patterns
```
1. **Multi-database queries**: Use `DatabaseHelper.execute_main_query()` for main DB, raw SQL for secondary databases. The PCP database is accessed separately - check `database.py` for `PCPSessionLocal`.
2. **Authentication**: JWT tokens set in request header as `Authorization: Bearer <token>` OR `x-access-token` (for Vue app compatibility). Token contains `user_id`, `user_role`, `country`.
3. **Error handling**: Use `HTTPException` with appropriate status codes. Return `ResponseModel` wrapper for consistency.
4. **Configuration**: All env vars in `backend/config.py` (Settings class) - reads from `.env` file. Never hardcode database credentials.
```
### Key Files
```
- [backend/auth.py](../backend/auth.py): JWT creation, password hashing (bcrypt), token validation
- [backend/models.py](../backend/models.py): Pydantic request/response schemas (UserBase, Token, DiseaseStatus, etc.)
- [backend/database.py](../backend/database.py): SQLAlchemy engines, DatabaseHelper with raw SQL execution methods
- [backend/routers/auth.py](../backend/routers/auth.py): Login endpoint pattern example
```
### Development Server
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 5800
```
```
API docs available at `http://localhost:5800/docs`
```
## Frontend (React/TypeScript)

### File Structure Patterns
```
- **`src/pages/*.tsx`**: Feature pages with RouteGuard wrapper (check auth before rendering)
- **`src/services/*.ts`**: API clients and business logic per feature (e.g., `rmtDataService.ts`, `pcpService.ts`)
- **`src/stores/*.ts`**: Global state using Zustand with persist middleware for persistence
- **`src/components/`**: Reusable UI components (Layout, Navbar, Sidebar, Modal helpers)
```
### Data Flow
```
1. **API calls** → `src/services/api.ts` (Axios instance with auth interceptors)
2. **State management** → Zustand stores (e.g., `authStore.ts`)
3. **Authentication**: Token stored in localStorage, automatically sent in request headers
4. **401 handling**: Interceptor clears token and redirects to `/login`
```
### Critical Patterns
```
1. **Page-level routing**: `src/AppRouter.tsx` wraps protected routes with `<RouteGuard requiresAuth={true}>`. Public routes don't require guard.
2. **Forms**: Use `react-hook-form` + `yup` for validation (see package.json)
3. **State persistence**: Zustand persist middleware saves auth state to localStorage
4. **API base URL**: Configurable via `REACT_APP_API_URL` env var, defaults to `http://localhost:5800`
```

### Key Files
```
- [frontend/src/AppRouter.tsx](../frontend/src/AppRouter.tsx): All routes defined here
- [frontend/src/services/api.ts](../frontend/src/services/api.ts): Central Axios instance and API method definitions
- [frontend/src/stores/authStore.ts](../frontend/src/stores/authStore.ts): Zustand store pattern example
- [frontend/src/components/RouteGuard.tsx](../frontend/src/components/RouteGuard.tsx): Authentication wrapper for protected routes
```
### Development Server
```bash
cd frontend
npm install
npm start
```
Runs on `http://localhost:3000` with hot reload

## Database
```

- **Host**: Configured in `.env` (db_host, db_user, db_pass)
- **Main DB** (`db_name`): Users, authentication, core entities
- **Secondary DBs** (`db2_name`, etc.): Feature-specific data (PCP, RMT, Training)
- **Type**: MySQL
- **Connection**: SQLAlchemy with PyMySQL driver, connection pooling enabled
See [backend/database.py](../backend/database.py) for `MainSessionLocal` and `PCPSessionLocal` engine setup.
```
## Common Workflows

### Adding a New Feature Endpoint
```
1. Create `backend/routers/feature_name.py` with APIRouter
2. Add raw SQL queries using `DatabaseHelper.execute_main_query()`
3. Import and include router in `backend/main.py`
4. Create matching frontend service in `frontend/src/services/featureNameService.ts`
5. Create page in `frontend/src/pages/FeatureName.tsx` wrapped with RouteGuard
6. Add route to `frontend/src/AppRouter.tsx`
```
### Testing Backend
```bash
cd backend
pytest test_server.py  # or test_fast_report.py for specific tests
```

### Building for Production
```bash
cd frontend
npm run build  # Creates optimized bundle in frontend/build/
```
FastAPI serves static files from `backend/static/` when `node_env=production`

## Deployment
```
- Reference: [deployment/README.md](../deployment/README.md)
- Server: AWS EC2 (IP: 13.49.235.70), shares host with TOM app
- Frontend port: 8080 (Nginx), Backend port: 5800 (FastAPI)
- Deployed via CircleCI → systemd service
```
## Important Notes
- **Branching**: Reference branch is `staging` (NOT main)
- **Token expiry**: 30 days (43200 minutes) - configured in `config.py`
- **CORS origins**: Include localhost:3000 for dev, production domains in `allowed_origins`
- **Two authentication formats**: Endpoints accept both `Authorization: Bearer` and `x-access-token` headers
- **Vue backend exists**: There's a separate Vue-based backend in `Vue/` directory - some API patterns maintain compatibility
