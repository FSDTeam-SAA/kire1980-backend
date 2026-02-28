# Quick Start: Prisma to Mongoose Migration

## What's Been Done (60% Complete)

✅ **Infrastructure Setup**

- MongoDB Docker container configured
- All Mongoose schemas created (11 schema files)
- NestJS Mongoose module configured
- Database connection service ready

✅ **Module Configuration**

- App module updated
- Auth, User, Job modules configured for Mongoose
- Common services module created
- Helper service for Mongoose operations

⚠️ **Remaining: Service Layer Updates**

- Auth service needs Mongoose implementation
- Job service needs Mongoose implementation
- Supporting services need updates

## Quick Installation

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Copy environment file
cp .env.example .env.local

# 3. Start MongoDB
docker compose up -d

# 4. Verify MongoDB is running
docker ps | grep mongodb
```

## Database Connection String

Update `.env.local`:

```env
DATABASE_URL=mongodb://admin:admin@127.0.0.1:27017/kire1980?authSource=admin
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=admin
MONGO_INITDB_DATABASE=kire1980
```

## Verify Setup

### Check MongoDB Connection

```bash
# Option 1: Via Mongo Express (GUI)
# Visit: http://localhost:8080

# Option 2: Via MongoDB CLI
docker exec -it mongodb mongosh -u admin -p admin --authenticationDatabase admin

# In MongoDB shell:
use kire1980
db.auth_users.find()
```

### Test NestJS App Build

```bash
# This will show remaining compilation errors (related to Prisma references)
npm run build 2>&1 | grep -E "error TS|Found.*error"

# Expected errors in:
# - src/auth/auth.service.ts
# - src/job/job.service.ts
# - src/common/services/activity-log.service.ts
# These need to be updated to use Mongoose
```

## What You Need to Do

### Immediate Actions (Required to Run App)

Update these 3 files to use Mongoose instead of Prisma:

1. **`src/auth/auth.service.ts`**
   - Replace `this.prismaService` with Mongoose model injections
   - Use `MongooseHelper` service for common operations
   - Convert `$transaction()` to Mongoose sessions

2. **`src/job/job.service.ts`**
   - Replace job queries with Mongoose operations
   - Convert separate table operations to array operations
   - Example: `job.notes.push(newNote); await job.save();`

3. **`src/common/services/activity-log.service.ts`**
   - Update to use ActivityLogEvent Mongoose model

### Optional Cleanup

- Delete `/prisma` folder
- Delete `src/common/services/prisma.service.ts`
- Update any remaining Prisma imports

## Key Files Reference

### Schemas Location

All in `/src/database/schemas/`:

- `auth-user.schema.ts` - User account
- `auth-security.schema.ts` - Security settings
- `user-profile.schema.ts` - Profile info
- `job.schema.ts` - Jobs (with nested subdocuments)
- `activity-log-event.schema.ts` - Audit logs
- Other models...

### Helper Service

`/src/auth/services/mongoose-helper.service.ts` - Common Mongoose operations ready to use

### Configuration

`/src/database/database.module.ts` - Global Mongoose config

## Example: Update a Service

### Current (Prisma) Code

```typescript
import { PrismaService } from '../common/services/prisma.service';

export class AuthService {
  constructor(private prismaService: PrismaService) {}

  async findUser(id: string) {
    return this.prismaService.authUser.findUnique({
      where: { id },
      include: { authSecurity: true },
    });
  }
}
```

### Updated (Mongoose) Code

```typescript
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthUser } from '../database/schemas';

export class AuthService {
  constructor(
    @InjectModel(AuthUser.name) private authUserModel: Model<AuthUser>,
  ) {}

  async findUser(id: string) {
    return this.authUserModel.findById(id).populate('authSecurity').exec();
  }
}
```

## Status Check

```bash
# Check compilation status
npm run build

# Expected output when complete:
# "Successfully compiled... N files"
```

## Troubleshooting

### MongoDB Connection Fails

```bash
# Check if MongoDB is running
docker logs mongodb

# Verify connection string in .env.local
# Should be: mongodb://admin:admin@127.0.0.1:27017/kire1980?authSource=admin
```

### Missing Module Errors

```bash
# May happen if NestJS module imports are wrong
# Check that all schema imports are correct:
import { AuthUser, AuthUserSchema } from '../database/schemas';
```

### Type Errors in Services

- This is expected - you're migrating from Prisma to Mongoose
- Follow the examples above to update service files
- Use `@InjectModel` decorator to inject models

## Next: Run the App

Once you update the service files:

```bash
# Development mode with hot reload
npm run start:dev

# Should see:
# [AppModule] DatabaseModule configured
# [NestApplication] NestJS started on port 5000
```

## Mongo Express GUI

After Docker starts:

- URL: http://localhost:8080
- View and manage MongoDB data visually
- No login required (BASICAUTH disabled)

## Support Files

- `MONGODB_MIGRATION.md` - Full migration guide
- `MIGRATION_GUIDE.md` - Technical reference
- Schema files - All in `/src/database/schemas/`

---

**Current Status:** 60% Complete - Infrastructure Ready, Awaiting Service Updates
