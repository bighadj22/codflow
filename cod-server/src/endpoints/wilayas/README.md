# Wilayas & Communes Reference API

Read-only API providing the official list of Algeria's 58 wilayas (provinces) and their constituent communes. This dataset serves as a foundational reference for orders, shipping rates, and customer profiles.

## Structure

```
wilayas/
├── routes.ts       # Public read-only routes
├── handlers.ts     # Handlers for listing and searching
├── queries.ts      # Optimized D1 queries for reference data
├── validation.ts   # Search filter schemas
├── openapi.ts      # OpenAPI documentation paths
└── README.md       # This file
```

## Core Concepts

The system contains a complete seed of Algeria's administrative divisions:
- **Wilayas:** 58 provinces, indexed 1–58.
- **Communes:** Local municipalities linked to their parent wilaya.
- **Bilingual:** All records include both Latin (French) and Arabic names for UI localization.

## API Endpoints

### GET /api/wilayas
List all 58 Algerian wilayas.

**Query Parameters:**
- `search` - Search by name in either Arabic or Latin characters (e.g., "Algiers" or "الجزائر").

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 16, "name": "Alger", "nameAr": "الجزائر" },
    { "id": 31, "name": "Oran", "nameAr": "وهران" }
  ],
  "count": 58
}
```

### GET /api/wilayas/:id/communes
Get the complete list of communes for a specific wilaya ID (1–58).

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "c-16-001", "name": "Alger Centre", "nameAr": "الجزائر الوسطى", "wilayaId": 16 },
    { "id": "c-16-002", "name": "Sidi M'Hamed", "nameAr": "سيدي امحمد", "wilayaId": 16 }
  ],
  "count": 13
}
```

## Implementation Details

- **Read-Only:** This module does not provide any write endpoints. Data is managed via system seeds.
- **Public Reference:** While authentication is required to access these endpoints, they do not require specific RBAC scopes beyond being an authenticated user.
- **Sorting:** Wilayas are sorted by their official ID (1-58). Communes are sorted alphabetically by their Latin name.
- **Cross-Module Usage:** The `id` values from these endpoints are used as `wilayaId` and `communeId` across the Orders, Shipping, and Customers APIs.
