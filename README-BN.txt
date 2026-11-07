GitHub main/root directory-তে এই তিনটি ফাইল আপলোড করুন: index.html, app.html, version.json।
APK-এর WebView-তে JavaScript, DOM Storage এবং IndexedDB enabled থাকতে হবে।
প্রথমবার এই সংশোধিত index.html APK-তে বসিয়ে নতুন APK build/install করতে হবে। এরপর app.html ও version.json বদলালেই পরের launch-এ update apply হবে।
Silent update-এর জন্য app.html-এর SHA-256 অবশ্যই version.json-এর sha256-এর সঙ্গে মিলতে হবে।
GitHub Pages URL: https://nisinex.github.io/MyOvertime/
