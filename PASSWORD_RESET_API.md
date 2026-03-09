# Password Reset API Documentation

## Overview

Three new APIs have been added to handle the forgot password flow with OTP verification.

## Endpoints

### 1. Forgot Password - Request OTP

**POST** `/auth/forgot-password`

Sends a password reset OTP to the user's email address.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "message": "If an account with that email exists, a password reset OTP has been sent."
}
```

**Features:**

- Rate limited to 3 requests per hour per email
- Generates a 6-digit OTP code
- OTP expires in 1 hour
- Email is queued for async processing
- Returns success even if email doesn't exist (prevents user enumeration)
- Checks if user is using OAuth provider and provides appropriate error

---

### 2. Verify Reset OTP

**POST** `/auth/verify-reset-otp`

Verifies the OTP code before allowing password reset.

**Request Body:**

```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response:**

```json
{
  "message": "OTP verified successfully. You can now reset your password.",
  "valid": true,
  "resetToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Features:**

- Generates a secure reset token valid for 15 minutes
- Deletes the OTP after successful verification
- Reset token is single-use only

**Error Responses:**

- Invalid OTP: `400 Bad Request` - "Invalid OTP"
- Expired OTP: `400 Bad Request` - "OTP expired or invalid. Please request a new password reset."

---

### 3. Reset Password

**POST** `/auth/reset-password`

Resets the user's password using the reset token from OTP verification.

**Request Body:**

```json
{
  "resetToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "newPassword": "NewSecurePassword123!"
}
```

**Response:**

```json
{
  "message": "Password reset successful. Please login with your new password."
}
```

**Features:**

- Validates reset token (15-minute expiry)
- No need to re-enter email and OTP
- Enforces password strength requirements (min 8 chars, uppercase, lowercase, numbers, special chars)
- Hashes password with bcrypt (12 rounds)
- Increments token version to invalidate all existing access tokens
- Logs password change activity
- Deletes reset token after use (single-use token)

**Error Responses:**

- Invalid/Expired token: `400 Bad Request` - "Reset token expired or invalid. Please verify your OTP again."
- Weak password: `400 Bad Request` - "Password does not meet security requirements"
- User not found: `404 Not Found` - "User not found"

## Implementation Details

### Security Features

1. **Rate Limiting**: 3 attempts per hour to prevent abuse
2. **OTP Expiry**: OTPs expire after 1 hour
3. **Reset Token Expiry**: Reset tokens expire after 15 minutes
4. **Single-Use Tokens**: Reset tokens are deleted after use
5. **Token Invalidation**: All access tokens are invalidated after password reset
6. **User Enumeration Prevention**: Same response for existing/non-existing emails
7. **Activity Logging**: All password reset attempts are logged
8. **Email History**: Email sending attempts are tracked in database

### Storage

- **OTPs** are stored in Redis with automatic expiration (1 hour)
  - Key format: `{prefix}:password_reset_token:{email}`
  - Contains: `{ otp, userId, email, expiresAt }`
- **Reset Tokens** are stored in Redis with automatic expiration (15 minutes)
  - Key format: `{prefix}:reset_token:{resetToken}`
  - Contains: `{ userId, email, createdAt }`
  - Deleted after OTP verification or password reset

### Email Template

A new HTML email template (`templates/emails/password-reset.html`) has been created with:

- Modern, responsive design
- Clear OTP code display
- Expiry time information
- Security warning for unsolicited requests

## Testing Flow

1. **Request OTP:Required - returns reset token):**

   ```bash
   curl -X POST http://localhost:5000/auth/verify-reset-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "otp": "123456"}'

   # Response will include:
   # {
   #   "message": "OTP verified successfully...",
   #   "valid": true,
   #   "resetToken": "a1b2c3d4e5f6..."
   # }
   ```

2. **Reset Password (using the reset token):**
   ```bash
   curl -X POST http://localhost:5000/auth/reset-password \
     -H "Content-Type: application/json" \
     -d '{
       "resetToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p
   ```
3. **Reset Password:**
   ```bash
   curl -X POST http://localhost:5000/auth/reset-password \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "otp": "123456",
       "newPassword": "NewSecurePassword123!"
     }'
   ```

## Files Modified/Created

##Reset tokens are cryptographically secure random strings

- Reset tokens are valid for 15 minutes after OTP verification
- Reset tokens are single-use only (deleted after password reset)
- All endpoints are rate-limited using the AUTH throttler config
- Password reset does NOT require the user to be logged in
- After successful password reset, user must login again with new password
- You cannot reset password directly with email + OTP; must verify OTP first to get reset token

### Modified:

- `src/auth/auth.service.ts` - Added 3 new methods
- `src/auth/auth.controller.ts` - Added 3 new endpoints
- `src/common/queues/email/email.queue.ts` - Added password reset email job
- `src/common/queues/email/email.processor.ts` - Added password reset email handler
- `src/common/services/email.service.ts` - Already had sendPasswordResetEmail method

## Notes

- OTP codes are 6-digit numeric codes
- All endpoints are rate-limited using the AUTH throttler config
- Password reset does NOT require the user to be logged in
- After successful password reset, user must login again with new password
