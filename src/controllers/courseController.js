@@ .. @@
     // Award points for course completion
     if (userCourse.progress === 100 && userCourse.progress !== 100) {
       await user.addPoints(50, `Completed course: ${course.title}`);
+      
+      // Trigger course completion webhook
+      setTimeout(async () => {
+        try {
+          await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhooks/zapier/course_completed`, {
+            method: 'POST',
+            headers: {
+              'Content-Type': 'application/json',
+              'X-API-Key': process.env.PLATFORM_API_KEY,
+            },
+            body: JSON.stringify({
+              userId: user._id,
+              courseId: course._id,
+              courseTitle: course.title,
+              completionDate: new Date(),
+            }),
+          });
+        } catch (error) {
+          console.log('Course completion webhook failed:', error.message);
+        }
+      }, 1000);
     }