# Setting Up Cron Job on cron-job.org

## Step-by-Step Instructions

### Step 1: Create Account
1. Go to https://cron-job.org
2. Click **"Sign Up"** or **"Register"**
3. Create a free account (email verification required)

### Step 2: Create New Cron Job

1. After logging in, click **"Create cronjob"** or **"New Cronjob"** button

2. Fill in the form:

   **Title:**
   ```
   Check WhatsApp Replies
   ```

   **Address (URL):**
   ```
   https://cloudtalk-new.vercel.app/api/check-whatsapp-replies
   ```

   **Schedule:**
   - Select **"Every X minutes"**
   - Enter: **5** (to check every 5 minutes)
   - Or select **"Every 10 minutes"** if you prefer less frequent checks

   **Request Method:**
   - Select **"GET"**

   **Notification:**
   - Optional: Enable email notifications if job fails
   - Enter your email address

3. Click **"Create cronjob"** or **"Save"**

### Step 3: Verify It's Working

1. After creating, the cron job will appear in your dashboard
2. Wait a few minutes, then check the **"Last execution"** column
3. Click on the job to see execution logs
4. You should see successful responses with status code 200

### Step 4: Test Manually (Optional)

Before waiting for the cron, test it manually:
1. Click on your cron job
2. Click **"Execute now"** or **"Run now"** button
3. Check the response - should show:
   ```json
   {
     "success": true,
     "checked": X,
     "updated": Y,
     ...
   }
   ```

## Recommended Settings

**For Active Monitoring:**
- **Frequency**: Every 5 minutes
- **Method**: GET
- **Notifications**: Enabled (to know if it fails)

**For Less Active:**
- **Frequency**: Every 10 minutes
- **Method**: GET
- **Notifications**: Optional

## What Happens

Every 5-10 minutes, cron-job.org will:
1. Call your endpoint: `https://cloudtalk-new.vercel.app/api/check-whatsapp-replies`
2. Your server checks for new incoming WhatsApp messages
3. If a client replied, it updates `electricity_bill_received = true` in the database
4. Returns a response showing how many messages were checked and updated

## Troubleshooting

**If the cron job fails:**
- Check the execution logs in cron-job.org
- Verify the URL is correct
- Make sure your Vercel server is running
- Check if there are any errors in the response

**If no updates are happening:**
- The endpoint is working correctly if it returns `"success": true`
- Updates only happen when:
  - A client replies to a message you sent
  - The phone number matches a record in `cloudtalk_calls`
  - `electricity_bill_received` is currently `false`

## Free Tier Limits

cron-job.org free tier typically allows:
- Multiple cron jobs
- Execution every 1 minute minimum
- Email notifications
- Execution history/logs

This is perfect for your use case!


