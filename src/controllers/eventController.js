@@ .. @@
   // Award points for attendance
   if (attended) {
     const user = await User.findById(userId);
     if (user) {
       await user.addPoints(event.points || 15, `Attended ${event.title}`);
+      
+      // Trigger event attendance webhook
+      setTimeout(async () => {
+        try {
+          await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhooks/zapier/event_attended`, {
+            method: 'POST',
+            headers: {
+              'Content-Type': 'application/json',
+              'X-API-Key': process.env.PLATFORM_API_KEY,
+            },
+            body: JSON.stringify({
+              userId,
+              eventId: event._id,
+              eventTitle: event.title,
+              attendanceDate: new Date(),
+            }),
+          });
+        } catch (error) {
+          console.log('Event attendance webhook failed:', error.message);
+        }
+      }, 1000);
     }
   }