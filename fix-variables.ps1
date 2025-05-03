$filePath = ".\server\storage.ts"
$content = Get-Content $filePath -Raw

# Find the problematic lines from the error messages and fix them
# Line 277: "const reading: Reading = {" -> "const newReading: Reading = {"
# Line 328: "const product: Product = {" -> "const newProduct: Product = {"
# Line 371: "const order: Order = {" -> "const newOrder: Order = {"

# Matching pattern for each variable with a bit of context to ensure accurate replacement
$readingPattern = "async createReading\(reading: InsertReading\): Promise<Reading> {.*?const reading: Reading = \{"
$readingReplacement = "async createReading(reading: InsertReading): Promise<Reading> {
    const data = await dbExecute(async (db) => {
      return await db.insert(readings).values(reading).returning();
    });

    const newReading: Reading = {"

$productPattern = "async createProduct\(product: InsertProduct\): Promise<Product> {.*?const product: Product = \{"
$productReplacement = "async createProduct(product: InsertProduct): Promise<Product> {
    const data = await dbExecute(async (db) => {
      return await db.insert(products).values(product).returning();
    });

    const newProduct: Product = {"

$orderPattern = "async createOrder\(order: InsertOrder\): Promise<Order> {.*?const order: Order = \{"
$orderReplacement = "async createOrder(order: InsertOrder): Promise<Order> {
    const data = await dbExecute(async (db) => {
      return await db.insert(orders).values(order).returning();
    });

    const newOrder: Order = {"

# Also need to fix the return statements at the end of these functions
$returnReadingPattern = "return reading;"
$returnReadingReplacement = "return newReading;"

$returnProductPattern = "return product;"
$returnProductReplacement = "return newProduct;"

$returnOrderPattern = "return order;"
$returnOrderReplacement = "return newOrder;"

# Perform all the replacements
$content = $content -replace $readingPattern, $readingReplacement
$content = $content -replace $productPattern, $productReplacement
$content = $content -replace $orderPattern, $orderReplacement
$content = $content -replace $returnReadingPattern, $returnReadingReplacement
$content = $content -replace $returnProductPattern, $returnProductReplacement
$content = $content -replace $returnOrderPattern, $returnOrderReplacement

# Write the changes back to the file
Set-Content -Path $filePath -Value $content

Write-Host "Variable redeclaration issues fixed in storage.ts"
