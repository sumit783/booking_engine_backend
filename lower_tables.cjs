const fs = require('fs');

const tables = [
  "User", "OTP", "RefreshToken", "Template", "Property", "PropertyGalleryImage",
  "Room", "RoomImage", "Package", "PackageImage", "RoomBlock", "PricingRule",
  "Booking", "SystemSetting", "Wallet", "WalletTransaction", "WithdrawalRequest",
  "Review", "ExtraPackage", "_prisma_migrations"
];

let content = fs.readFileSync('Dump20260715.sql', 'utf-8');

tables.forEach(tableName => {
  const exactMatch = `\`${tableName}\``;
  const lowerMatch = `\`${tableName.toLowerCase()}\``;
  content = content.split(exactMatch).join(lowerMatch);
});

// Also replace without backticks in the comment lines like "-- Table structure for table `User`"
// Wait, the backtick replacement above handles comments if they have backticks!
// What if they don't have backticks? e.g. "-- Table structure for table User" -> mysqldump always uses backticks for table names in comments.

fs.writeFileSync('Dump20260715.sql', content);
console.log('Successfully lowercased all table names in the dump!');
