---
name: customer-management
description: Manage customer records in the COD CRM system. Use this skill when users want to search for customers, create new customer profiles, update customer information, look up customers by phone number, view customer order history, check customer groups and tags, or delete customer records. Also use when users mention Algerian phone numbers, wilayas (1-58), customer data, CRM operations, or need to find/modify customer information.
---

# Customer Management Skill

This skill helps you effectively manage customer records in the COD (Cash on Delivery) CRM system for Algerian e-commerce operations.

## When to Use This Skill

Use this skill whenever the user needs to:
- Search for customers by name, phone, wilaya, group, or tag
- Create new customer profiles
- Update existing customer information
- Look up a customer by their phone number
- View a customer's order history
- Check which groups or tags a customer belongs to
- Delete customer records (with safety checks)

## Core Concepts

### Algerian Context
This CRM is designed for Algerian e-commerce, so understanding the local context is important:

- **Phone Numbers**: Algerian mobile numbers follow the format `0[5-7]XXXXXXXX` (10 digits starting with 05, 06, or 07)
- **Wilayas**: Algeria has 58 administrative divisions (wilayas), numbered 1-58. Each customer must be assigned to a wilaya.
- **Communes**: Subdivisions within wilayas. These are optional but help with delivery routing.

### Customer Data Structure
Each customer record contains:
- Basic info: name, phone (required), phone2 (optional)
- Location: wilayaId (1-58, required), communeId (optional), address (optional)
- Metrics: totalOrders, totalSpent, lastOrderAt (auto-calculated)
- Relationships: groups (for segmentation), tags (for categorization)

## Available Tools

You have access to 8 customer management tools. Here's how to use them effectively:

### 1. listCustomers - Discovery and Search

Use this when the user wants to browse customers or find multiple matches.

**Good for:**
- "Show me all customers in Algiers" (wilayaId: 16)
- "Find customers in the VIP group"
- "Search for customers named Ahmed"
- "List customers with the 'high-value' tag"

**Parameters:**
- `wilayaId`: Filter by wilaya (1-58)
- `search`: Search in name or phone (partial match works)
- `groupId`: Filter by customer group UUID
- `tagId`: Filter by customer tag UUID
- `limit`: Max results (default 50, max 100)
- `offset`: For pagination

**Example:**
```javascript
{
  "wilayaId": 16,
  "search": "ahmed",
  "limit": 20
}
```

**What you get back:**
A list with basic info: id, name, phone, wilaya, commune, totalSpent, totalOrders, lastOrderAt

### 2. getCustomerDetails - Full Profile

Use this when you need complete information about a specific customer.

**Good for:**
- "Show me everything about customer X"
- "What's the full profile for this customer?"
- Getting address details and recent orders

**Parameters:**
- `customerId`: The UUID of the customer

**What you get back:**
Full customer record plus their 10 most recent orders

### 3. findCustomerByPhone - Quick Lookup

Use this for fast phone-based lookups. This is often the most natural way to find a customer since phone numbers are unique identifiers.

**Good for:**
- "Find the customer with phone 0551234567"
- "Look up 0661234567"
- When a user provides a phone number in any context

**Parameters:**
- `phone`: Algerian phone number (0[5-7]XXXXXXXX)

**Pro tip:** If the user gives you a phone number in any format, normalize it first. Remove spaces, dashes, or country codes (+213). The format must be exactly 10 digits starting with 05, 06, or 07.

### 4. createNewCustomer - Registration

Use this to register new customers in the system.

**Required fields:**
- `name`: Full name
- `phone`: Primary phone (must be unique, format: 0[5-7]XXXXXXXX)
- `wilayaId`: Number from 1-58

**Optional fields:**
- `phone2`: Secondary phone
- `communeId`: UUID of the commune
- `address`: Full address string

**Important validations:**
- Phone numbers must match the Algerian format exactly
- wilayaId must be between 1 and 58
- The phone number must not already exist in the system

**Error handling:**
If you get a duplicate phone error, suggest using `findCustomerByPhone` to retrieve the existing record instead.

**Example:**
```javascript
{
  "name": "Ahmed Benali",
  "phone": "0551234567",
  "wilayaId": 16,
  "address": "123 Rue Didouche Mourad, Alger Centre"
}
```

### 5. updateCustomerProfile - Modifications

Use this to update existing customer information. Only include fields you want to change.

**Parameters:**
- `customerId`: UUID of the customer to update
- `updates`: Object with fields to modify

**Updatable fields:**
- `name`: New name
- `phone`: New primary phone
- `phone2`: New secondary phone (or null to clear)
- `wilayaId`: New wilaya (1-58)
- `communeId`: New commune UUID (or null to clear)
- `address`: New address (or null to clear)

**Important:**
- If updating the phone number, it must not be used by another customer
- All validation rules apply (phone format, wilaya range)

**Example:**
```javascript
{
  "customerId": "abc-123-def",
  "updates": {
    "address": "New address here",
    "phone2": null  // Clear secondary phone
  }
}
```

### 6. getCustomerOrderHistory - Order Tracking

Use this to see all orders placed by a customer.

**Good for:**
- "Show me all orders from this customer"
- "What has customer X ordered?"
- Checking order patterns or history

**Parameters:**
- `customerId`: UUID of the customer

**What you get back:**
List of orders with: id, orderNumber, status, totalPrice, createdAt, wilaya, commune

### 7. getCustomerMemberships - Segmentation Info

Use this to see which groups and tags are assigned to a customer.

**Good for:**
- "What groups is this customer in?"
- "Show me this customer's tags"
- Understanding customer segmentation

**Parameters:**
- `customerId`: UUID of the customer

**What you get back:**
- `groups`: Array of customer groups with details
- `tags`: Array of customer tags with details
- `groupCount`: Number of groups
- `tagCount`: Number of tags

### 8. deleteCustomer - Removal (Use with Caution)

Use this to permanently delete a customer record. This is a destructive operation with safety checks.

**Safety rules:**
- Cannot delete customers who have orders
- This is permanent - no undo

**Good for:**
- Removing test/duplicate records
- Cleaning up customers with no order history

**Parameters:**
- `customerId`: UUID of the customer to delete

**Error handling:**
If the customer has orders, the tool will tell you how many. Suggest archiving or tagging instead of deletion.

## Common Workflows

### Workflow 1: New Customer Registration

When a user wants to add a new customer:

1. Gather required info: name, phone, wilayaId
2. Validate the phone format (0[5-7]XXXXXXXX)
3. Call `createNewCustomer` with the data
4. If you get a duplicate phone error, use `findCustomerByPhone` to show the existing record
5. Confirm success and show the new customer ID

### Workflow 2: Customer Lookup

When a user asks about a customer:

1. **If they provide a phone number**: Use `findCustomerByPhone` first (fastest)
2. **If they provide a name**: Use `listCustomers` with search parameter
3. **If they provide a customer ID**: Use `getCustomerDetails` directly
4. **If multiple matches**: Show the list and ask which one they meant

### Workflow 3: Update Customer Info

When a user wants to modify customer data:

1. First, find the customer (using phone, name, or ID)
2. Confirm which customer they mean if there are multiple matches
3. Ask what they want to change
4. Call `updateCustomerProfile` with only the fields being modified
5. Show the updated information

### Workflow 4: Customer Research

When a user wants to analyze or segment customers:

1. Use `listCustomers` with appropriate filters (wilaya, group, tag)
2. For detailed analysis, fetch full details with `getCustomerDetails`
3. Check order history with `getCustomerOrderHistory`
4. Review segmentation with `getCustomerMemberships`

## Best Practices

### Phone Number Handling

Phone numbers are critical identifiers. Always:
- Validate format before creating/updating: `0[5-7]XXXXXXXX`
- Remove spaces, dashes, or formatting: "055 123 4567" → "0551234567"
- Strip country codes: "+213551234567" → "0551234567"
- Use `findCustomerByPhone` when you have a phone number - it's the fastest lookup

### Wilaya Management

Wilayas are numbered 1-58. Common ones users might mention:
- Algiers (Alger): 16
- Oran: 31
- Constantine: 25
- Annaba: 23

If a user mentions a wilaya by name, you may need to look up its number. The system stores both the ID (number) and the Arabic name.

### Error Recovery

When operations fail:

**Duplicate phone**: Don't just report the error. Use `findCustomerByPhone` to show the existing customer and ask if they want to update that record instead.

**Customer not found**: If searching by name returns no results, suggest:
- Trying a partial name
- Searching by phone if they have it
- Checking the wilaya filter

**Validation errors**: The tools provide detailed error messages. Parse them and explain to the user in plain language what needs to be fixed.

### Data Privacy

Customer data is sensitive. When showing customer information:
- Only display what's necessary for the task
- Don't log or store customer data outside the system
- Be mindful of phone numbers and addresses

## Tool Response Patterns

All tools return responses in this format:

**Success:**
```javascript
{
  "success": true,
  "customer": { /* customer data */ },
  "message": "Customer created successfully"
}
```

**Failure:**
```javascript
{
  "success": false,
  "error": "Detailed error message with guidance"
}
```

Always check the `success` field first. If false, the `error` field contains a helpful message explaining what went wrong and often suggests how to fix it.

## Performance Tips

1. **Use the right tool for the job**: `findCustomerByPhone` is faster than `listCustomers` with a phone search
2. **Limit results**: When using `listCustomers`, set appropriate limits to avoid overwhelming responses
3. **Batch operations**: If you need details on multiple customers, fetch the list first, then get details only for the ones the user cares about
4. **Cache customer IDs**: Once you've found a customer, remember their ID for subsequent operations in the same conversation

## Common Mistakes to Avoid

1. **Don't guess wilaya IDs**: If the user mentions a wilaya by name and you're not sure of the number, ask them or look it up
2. **Don't skip phone validation**: Always validate phone format before calling create/update tools
3. **Don't delete without checking**: Always warn users that deletion is permanent and only works for customers without orders
4. **Don't update everything**: When updating, only include fields that are actually changing
5. **Don't ignore error messages**: The error messages contain actionable guidance - use them to help the user

## Examples

### Example 1: Creating a Customer
```
User: "Add a new customer named Fatima Zohra, phone 0661234567, in Oran"

You should:
1. Recognize Oran = wilaya 31
2. Validate phone format (✓ correct)
3. Call createNewCustomer:
   {
     "name": "Fatima Zohra",
     "phone": "0661234567",
     "wilayaId": 31
   }
4. Confirm: "Customer Fatima Zohra created successfully with ID: [uuid]"
```

### Example 2: Finding and Updating
```
User: "Change the address for 0551234567 to 456 Rue Larbi Ben M'hidi"

You should:
1. Call findCustomerByPhone with "0551234567"
2. Get the customer ID from the response
3. Call updateCustomerProfile:
   {
     "customerId": "[uuid from step 2]",
     "updates": {
       "address": "456 Rue Larbi Ben M'hidi"
     }
   }
4. Confirm the update
```

### Example 3: Handling Duplicates
```
User: "Create customer Ahmed, phone 0551234567, wilaya 16"

You call createNewCustomer and get:
{
  "success": false,
  "error": "A customer with phone number 0551234567 already exists..."
}

You should:
1. Explain the phone is already registered
2. Call findCustomerByPhone("0551234567") to show the existing customer
3. Ask: "This phone is already registered to [name]. Did you want to update that customer instead?"
```

## Summary

This skill gives you comprehensive customer management capabilities. The key to using it well is:
- Understanding the Algerian context (phone formats, wilayas)
- Choosing the right tool for each task
- Validating data before operations
- Handling errors gracefully with helpful suggestions
- Protecting customer privacy

When in doubt, start with a lookup operation to understand what you're working with, then proceed with modifications or analysis.
