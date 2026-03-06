# Country Manager View Extraction Guide

## Overview
This document provides comprehensive instructions for extracting and recreating the Country Manager view functionality from the TMS-pilot Vue.js application into a React application. The Country Manager view allows users with the TFP role to view position-competency-level assignments for their country. This is a **read-only view** with no editing or assignment capabilities.

**✨ This guide uses a simplified, optimized approach with:**
- Single unified API endpoint (instead of 4 separate endpoints)
- One SQL query with all JOINs (no client-side lookups)
- Clean data structure with all names resolved server-side
- Reduced network overhead and faster performance
- Simpler frontend code with fewer transformations

---

## Table of Contents
1. [Core Functionality](#core-functionality)
2. [Database Schema](#database-schema)
3. [Backend API Endpoints](#backend-api-endpoints)
4. [Frontend Components](#frontend-components)
5. [Data Flow and Business Logic](#data-flow-and-business-logic)
6. [Implementation Steps for React](#implementation-steps-for-react)
7. [Dependencies and Libraries](#dependencies-and-libraries)

---

## 1. Core Functionality

The Country Manager view provides the following capabilities:

### Primary Features:
1. **View Positions**: Display all positions available for the country
2. **View Assigned Competencies**: Show competencies assigned to each position with their required levels
3. **Display Level Details**: Show the competency level names (Awareness, Beginner, Competent, etc.)
4. **Searchable/Filterable**: Allow filtering or searching through positions and competencies

### User Workflow:
1. System loads positions for the country (country from user logged in provided as parameter)
2. User can:
   - View all positions in a table
   - See assigned competencies and levels for each position
   - Filter or search positions and competencies (optional)
   - View detailed information about each assignment

---

## 2. Database Schema

### 2.1 Schema Comparison & Trade-offs

#### Simplified (ENUM) vs. Normalized (Separate Table)

**Option A: Simplified - ENUM for Levels** ⭐ **RECOMMENDED if levels rarely change**
- 4 Tables, 3 JOINs
- ✅ 25% fewer JOINs, faster queries
- ✅ Simpler code, no ID lookups
- ✅ Self-documenting data
- ⚠️ **Levels are hardcoded in schema** - requires ALTER TABLE to change
- ⚠️ Not suitable if levels change frequently or need admin UI

**Option B: Normalized - Separate `levels` Table** (Use if you need flexibility)
- 5 Tables, 4 JOINs
- ✅ Levels can be modified via INSERT/UPDATE/DELETE
- ✅ Admin UI can manage levels dynamically
- ✅ Audit trail of level changes possible
- ❌ Extra JOIN in every query
- ❌ Requires ID-to-name lookups

#### Decision Guide:

**Use ENUM (Option A) if:**
- Levels are industry-standard and won't change (e.g., "Awareness" through "Expert")
- You have 5 fixed levels that are part of a recognized competency framework
- Performance is important
- You don't need an admin UI to manage levels

**Use Separate Table (Option B) if:**
- Levels might change (add level 6, rename levels, etc.)
- You need admin users to manage level definitions
- You want to track when levels were added/modified
- You need descriptions or metadata for each level
- Multiple systems share the same levels table

#### Changing ENUM Levels Later:

If you use ENUM and need to modify levels, it requires a schema change:

```sql
-- Add a new level
ALTER TABLE position_competency_by_country 
MODIFY level_required ENUM('Awareness', 'Beginner', 'Competent', 'Proficient', 'Expert', 'Master');

-- Rename a level (requires data migration)
UPDATE position_competency_by_country 
SET level_required = 'Advanced' 
WHERE level_required = 'Expert';

ALTER TABLE position_competency_by_country 
MODIFY level_required ENUM('Awareness', 'Beginner', 'Competent', 'Proficient', 'Advanced');
```

**Note:** Schema changes require deployment and can't be done through an admin UI.

---

### 2.2 Option A: Simplified Schema with ENUM (Recommended for Fixed Levels)

**Use this if:** Your 5 competency levels are fixed and based on a standard framework.

#### Table 1: `countries`
Stores country information.

```sql
CREATE TABLE `countries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `code_moodle` varchar(255) DEFAULT NULL,
  `code_iso2` varchar(255) DEFAULT NULL,
  `code_iso3` varchar(255) DEFAULT NULL,
  `region` varchar(255) DEFAULT NULL,
  `eufmd_mn` int DEFAULT NULL,
  `programs_view` tinyint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_country_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

#### Table 2: `positions`
Stores job positions.

```sql
CREATE TABLE `positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  PRIMARY KEY (`id`),
  KEY `idx_position_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

#### Table 3: `competencies`
Stores competency definitions.

```sql
CREATE TABLE `competencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_competency_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Sample Data
INSERT INTO `competencies` (name) VALUES 
  ('Epidemiology'),
  ('Transboundary Animal Diseases'),
  ('Disease Prevention and Control Programs'),
  ('Biosecurity'),
  ('Sampling'),
  ('ID and Movement Control'),
  ('Emergency and Disaster Management'),
  ('Emergency Preparedness'),
  ('Emergency response'),
  ('Veterinary Products'),
  ('Animal Welfare'),
  ('Risk Analysis'),
  ('Safety, Health and Well being');
```

#### Table 4: `position_competency_by_country`
**Core table** - Links positions to competencies with required levels for each country.

**✨ Simplified: Uses ENUM for levels instead of separate table**

```sql
CREATE TABLE `position_competency_by_country` (
  `id` int NOT NULL AUTO_INCREMENT,
  `country_id` int NOT NULL,
  `position_id` int NOT NULL,
  `competency_id` int NOT NULL,
  `level_required` ENUM('Awareness', 'Beginner', 'Competent', 'Proficient', 'Expert') NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_assignment` (`country_id`, `position_id`, `competency_id`),
  KEY `idx_country` (`country_id`),
  KEY `idx_position` (`position_id`),
  KEY `idx_competency` (`competency_id`),
  CONSTRAINT `fk_country` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Key Improvements:**
- ✅ **Removed `levels` table** - used ENUM instead for 5 fixed values
- ✅ **3 foreign keys instead of 4** - simpler relationships
- ✅ **Direct level names** - no ID-to-name lookups needed
- ✅ **Added timestamps** - audit trail for changes
- ✅ **Cleaner constraint names** - easier to understand
- ✅ **Proper indexes** - optimized for queries
- ⚠️ **Hardcoded levels** - changing levels requires ALTER TABLE

---

### 2.3 Option B: Normalized Schema with Levels Table (For Dynamic Levels)

**Use this if:** You need flexibility to add/modify/remove levels through an admin interface.

This is the original 5-table schema. Keep the `levels` table separate if:
- Levels might change in the future
- You want admin users to manage level definitions
- You need audit trails for level changes
- Multiple applications share the same levels

<details>
<summary>Click to see full normalized 5-table schema</summary>

```sql
-- Original levels table
CREATE TABLE `levels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `sort_order` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_level_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `levels` (id, name, sort_order) VALUES 
  (1, 'Awareness', 1),
  (2, 'Beginner', 2),
  (3, 'Competent', 3),
  (4, 'Proficient', 4),
  (5, 'Expert', 5);

-- Countries table (same as Option A)
CREATE TABLE `countries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `code_moodle` varchar(255) DEFAULT NULL,
  `code_iso2` varchar(255) DEFAULT NULL,
  `code_iso3` varchar(255) DEFAULT NULL,
  `region` varchar(255) DEFAULT NULL,
  `eufmd_mn` int DEFAULT NULL,
  `programs_view` tinyint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_country_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Positions table (same as Option A)
CREATE TABLE `positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  PRIMARY KEY (`id`),
  KEY `idx_position_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Competencies table (same as Option A)
CREATE TABLE `competencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_competency_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Junction table with level_required as INT FK
CREATE TABLE `position_competency_by_country` (
  `id` int NOT NULL AUTO_INCREMENT,
  `country_id` int NOT NULL,
  `position_id` int NOT NULL,
  `competency_id` int NOT NULL,
  `level_required` int NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_assignment` (`country_id`, `position_id`, `competency_id`),
  KEY `idx_country` (`country_id`),
  KEY `idx_position` (`position_id`),
  KEY `idx_competency` (`competency_id`),
  KEY `idx_level` (`level_required`),
  CONSTRAINT `fk_country` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_level` FOREIGN KEY (`level_required`) REFERENCES `levels` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Benefits of this approach:**
- ✅ Levels can be modified via SQL or admin UI (INSERT, UPDATE, DELETE)
- ✅ Can add metadata (description, sort_order, color codes, etc.)
- ✅ Can track level history with audit tables
- ✅ More "proper" database normalization

**Trade-offs:**
- ❌ Requires 4 JOINs instead of 3
- ❌ Slightly slower queries
- ❌ More complex code with ID lookups

</details>

**Recommendation:** Based on industry standards, competency levels (Awareness → Beginner → Competent → Proficient → Expert) are typically fixed. If your organization follows a standard framework (e.g., Dreyfus model, Bloom's taxonomy), **use Option A (ENUM)**. If you anticipate needing to customize or extend levels, use Option B (separate table).

---

### 2.4 Migration Script (If Converting from 5-table to 4-table)

```sql
-- Step 1: Backup existing data
CREATE TABLE position_competency_backup AS 
SELECT * FROM position_competency_by_country;

-- Step 2: Drop old table
DROP TABLE position_competency_by_country;

-- Step 3: Create new simplified table with ENUM
CREATE TABLE `position_competency_by_country` (
  `id` int NOT NULL AUTO_INCREMENT,
  `country_id` int NOT NULL,
  `position_id` int NOT NULL,
  `competency_id` int NOT NULL,
  `level_required` ENUM('Awareness', 'Beginner', 'Competent', 'Proficient', 'Expert') NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_assignment` (`country_id`, `position_id`, `competency_id`),
  KEY `idx_country` (`country_id`),
  KEY `idx_position` (`position_id`),
  KEY `idx_competency` (`competency_id`),
  CONSTRAINT `fk_country` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Step 4: Migrate data (convert level IDs to names)
INSERT INTO position_competency_by_country 
  (id, country_id, position_id, competency_id, level_required)
SELECT 
  b.id,
  b.country_id,
  b.position_id,
  b.competency_id,
  CASE b.level_required
    WHEN 1 THEN 'Awareness'
    WHEN 2 THEN 'Beginner'
    WHEN 3 THEN 'Competent'
    WHEN 4 THEN 'Proficient'
    WHEN 5 THEN 'Expert'
  END
FROM position_competency_backup b;

-- Step 5: Verify migration
SELECT COUNT(*) as backup_count FROM position_competency_backup;
SELECT COUNT(*) as new_count FROM position_competency_by_country;
-- Counts should match

-- Step 6: Drop levels table (after verification)
-- DROP TABLE levels;
-- DROP TABLE position_competency_backup;
```

---

## 3. Backend API Endpoints

**Note:** Since authentication is handled by the TFP role-based system, all endpoints will receive `country` (string - country name from user session) as a parameter (via query string, route parameter, or request body) instead of extracting it from a JWT token.

### 3.1 GET All Competencies
**Endpoint:** `GET /api/competencies?country={country_name}`

**Purpose:** Fetch all competencies with their positions and required levels for the specified country.

**Query Parameters:**
- `country`: Country name (string, required)

**Response:**
```json
{
  "Position Name 1": [
    {
      "id": 1,
      "name": "Epidemiology",
      "required_level": 3,
      "position": "Central veterinarian"
    }
  ],
  "Position Name 2": [...]
}
```

**SQL Query:**
```sql
SELECT 
  competencies.id, 
  competencies.name, 
  position_competency_by_country.level_required AS "required_level", 
  positions.name AS "position"
FROM position_competency_by_country 
INNER JOIN positions ON position_competency_by_country.position_id = positions.id 
INNER JOIN competencies ON position_competency_by_country.competency_id = competencies.id
INNER JOIN countries ON position_competency_by_country.country_id = countries.id
WHERE countries.name = {country_name};
```

**Backend Implementation:**
```javascript
router.get("/", async function (req, res) {
  const { country } = req.query;
  try {
    const competencies = (
      await db(
        `SELECT competencies.id, competencies.name, position_competency_by_country.level_required AS "required_level", positions.name AS "position"
        FROM position_competency_by_country 
        INNER JOIN positions ON position_competency_by_country.position_id = positions.id 
        INNER JOIN competencies ON position_competency_by_country.competency_id = competencies.id
        INNER JOIN countries ON position_competency_by_country.country_id = countries.id
        WHERE countries.name = "${country}";`
      )
    ).data;

    // Group by position
    const competenciesByPosition = groupBy(competencies, "position");
    res.send(competenciesByPosition);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});
```

### 3.2 GET Competencies by Position
**Endpoint:** `GET /api/positions/competencies/?country={country_name}`

**Purpose:** Fetch position-competency assignments with detailed information for the table view.

**Query Parameters:**
- `country`: Country name (string, required)

**Response:**
```json
[
  {
    "id": 4,
    "country_id": 3,
    "position_id": 5,
    "competency_id": 3,
    "level_required": 3,
    "position": "Regional veterinarian",
    "competency": "Disease Prevention and Control Programs"
  },
  ...
]
```

**SQL Query:**
```sql
SELECT 
  pcbc.*, 
  p.name as position, 
  c.name as competency
FROM position_competency_by_country pcbc 
JOIN positions p ON pcbc.position_id = p.id
JOIN competencies c ON pcbc.competency_id = c.id
JOIN countries co ON pcbc.country_id = co.id
WHERE co.name = {country_name};
```

**Backend Implementation:**
```javascript
router.get("/competencies/", async function (req, res) {
  const { country } = req.query;
  try {
    const competenciesByPosition = (
      await db(
        `SELECT pcbc.*, p.name as position, c.name as competency
        FROM position_competency_by_country pcbc 
        JOIN positions p ON pcbc.position_id = p.id
        JOIN competencies c ON pcbc.competency_id = c.id
        JOIN countries co ON pcbc.country_id = co.id
        WHERE co.name = "${country}";`
      )
    ).data;

    res.send(competenciesByPosition);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});
```

### 3.3 GET Competencies by Position with Levels
**Endpoint:** `GET /api/positions/competencies-levels/?country={country_name}`

**Purpose:** Extended version that includes level names (not just IDs).

**Query Parameters:**
- `country`: Country name (string, required)

**Response:**
```json
[
  {
    "id": 4,
    "position": "Regional veterinarian",
    "competency": "Disease Prevention and Control Programs",
    "level_required": 3,
    "level": "Competent"
  },
  ...
]
```

**SQL Query:**
```sql
SELECT 
  pcbc.id, 
  p.name as position, 
  c.name as competency, 
  pcbc.level_required, 
  l.name as level
FROM position_competency_by_country pcbc 
JOIN positions p ON pcbc.position_id = p.id
JOIN competencies c ON pcbc.competency_id = c.id
JOIN levels l ON pcbc.level_required = l.id
JOIN countries co ON pcbc.country_id = co.id
WHERE co.name = {country_name};
```

### 3.4 GET All Positions
**Endpoint:** `GET /api/positions/?country={country_name}`

**Purpose:** Fetch all positions for the specified country.

**Query Parameters:**
- `country`: Country name (string, required)

**Response:**
```json
[
  {
    "id": 1,
    "country_id": 3,
    "name": "Central veterinarian"
  },
  ...
]
```

**SQL Query:**
```sql
SELECT DISTINCT 
  p.id, 
  pcbc.country_id, 
  p.name as name
FROM position_competency_by_country pcbc 
JOIN positions p ON pcbc.position_id = p.id
JOIN countries co ON pcbc.country_id = co.id
WHERE co.name = {country_name};
```

---

## 4. Frontend Components

### 4.1 Main View Component (CM.vue)

**File Location (Vue app):** `client/src/views/CM.vue`

**Component Structure:**
```vue
<template>
  <div>
    <div class="container">
      <!-- Header -->
      <div class="header">
        <h2>Position-Competency Assignments</h2>
        <p>Viewing assignments for country</p>
      </div>

      <!-- Positions Table Component (Read-Only) -->
      <positions-table 
        :positions="positions"
        :competenciesByPosition="competenciesByPosition"
      />
    </div>
  </div>
</template>
```

**Data Properties:**
```javascript
data() {
  return {
    data: [],
    levels: {
      0: "No level",
      1: "Awareness",
      2: "Beginner",
      3: "Competent",
      4: "Proficient",
      5: "Expert",
    },
    positions: [],
    competenciesByPosition: {},
    loading: false,
  };
}
```

**Key Methods:**
```javascript
methods: {
  async loadData() {
    this.loading = true;
    const { data, competencies } = await api.getData();
    const cbp = await api.getCompetencies();
    this.positions = Object.keys(cbp);
    this.competenciesByPosition = cbp;
    this.loading = false;
  },
},

mounted() {
  this.loadData();
}
```

### 4.2 Positions Table Component (PositionsTable.vue)

**File Location (Vue app):** `client/src/components/PositionsTable.vue`

**Component Structure:**
```vue
<template>
  <div class="border-t">
    <table class="w-full">
      <thead>
        <tr>
          <th>Position</th>
          <th>Assigned Competencies</th>
          <th>Required Levels</th>
        </tr>
      </thead>

      <template v-for="position in positions">
        <tr>
          <td>{{ position }}</td>
          <td>
            <ul>
              <li v-for="competency in competenciesByPosition">
                <div v-if="competency.position_id == positions.indexOf(position) + 1">
                  {{ competency.competency }}
                </div>
              </li>
            </ul>
          </td>
          <td>
            <ul>
              <li v-for="competency in competenciesByPosition">
                <div v-if="competency.position_id == positions.indexOf(position) + 1">
                  {{ getLevelName(competency.level_required) }}
                </div>
              </li>
            </ul>
          </td>
        </tr>
      </template>
    </table>
  </div>
</template>
```

**Props:**
```javascript
props: ["positions", "competenciesByPosition"]
```

**Data Properties:**
```javascript
data() {
  return {
    levels: {
      1: "Awareness",
      2: "Beginner",
      3: "Competent",
      4: "Proficient",
      5: "Expert",
    },
  };
}
```

**Key Methods:**
```javascript
methods: {
  getLevelName(levelId) {
    return this.levels[levelId] || "Unknown";
  },
}
```

### 4.3 API Service Methods

**File Location (Vue app):** `client/src/services/data.js`

```javascript
export default {
  // Get competencies grouped by position
  async getCompetencies() {
    const competencies = await (
      await fetch("api/competencies", {
        headers: {
          "x-access-token": localStorage.getItem("token"),
        },
      })
    ).json();
    return competencies;
  },

  // Get competencies by position with full details
  async getCompetenciesByPosition() {
    const competenciesByPosition = await (
      await fetch(`api/positions/competencies/`, {
        headers: {
          "x-access-token": localStorage.getItem("token"),
        },
      })
    ).json();
    return competenciesByPosition;
  },

  // Get position-competency-level combinations
  async getPositionCompetencyByCountry() {
    const positionCompetencyByCountry = await (
      await fetch(`api/positions/competencies-levels/`, {
        headers: {
          "x-access-token": localStorage.getItem("token"),
        },
      })
    ).json();
    return positionCompetencyByCountry;
  },

  // Assign competency to position(s)
  async assignRequiredCompetency(positionId, competencyId, levelId) {
    try {
      const res = await fetch(`api/positions/${positionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": localStorage.getItem("token"),
        },
        body: JSON.stringify({ competencyId, levelId }),
      });
      return res;
    } catch (error) {
      return console.log(error);
    }
  },

  // Delete competency assignment from position
  async deleteRequiredCompetency(positionId, competencyId, levelId) {
    try {
      const res = await fetch(`api/positions/${positionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": localStorage.getItem("token"),
        },
        body: JSON.stringify({ competencyId, levelId }),
      });
      return res;
    } catch (error) {
      return console.log(error);
    }
  },
}
```

---

## 5. Data Flow and Business Logic

### 5.1 Simplified Architecture Recommendation

**Current Problems:**
1. ❌ Multiple redundant API calls fetching similar data in different formats
2. ❌ Complex data transformations between backend and frontend
3. ❌ Inefficient queries with repeated JOINs
4. ❌ Client-side level ID-to-name lookups
5. ❌ Fragile position ID mapping using array indices

**Proposed Simplification:**

#### Single Unified API Endpoint

Replace all 4 separate endpoints with **one** comprehensive endpoint:

**Endpoint:** `GET /api/country-manager/assignments?country={country_name}`

**Single SQL Query (Simplified Schema with ENUM):**
```sql
SELECT 
  p.id as position_id,
  p.name as position_name,
  c.id as competency_id,
  c.name as competency_name,
  pcbc.level_required as level_name,
  pcbc.id as assignment_id
FROM position_competency_by_country pcbc 
JOIN positions p ON pcbc.position_id = p.id
JOIN competencies c ON pcbc.competency_id = c.id
JOIN countries co ON pcbc.country_id = co.id
WHERE co.name = ?
ORDER BY p.name, c.name;
```

**✨ Key Improvement:** Only **3 JOINs** instead of 4 (removed levels table join)

<details>
<summary>Alternative: If using original 5-table schema with levels table</summary>

```sql
SELECT 
  p.id as position_id,
  p.name as position_name,
  c.id as competency_id,
  c.name as competency_name,
  l.id as level_id,
  l.name as level_name,
  pcbc.id as assignment_id
FROM position_competency_by_country pcbc 
JOIN positions p ON pcbc.position_id = p.id
JOIN competencies c ON pcbc.competency_id = c.id
JOIN levels l ON pcbc.level_required = l.id
JOIN countries co ON pcbc.country_id = co.id
WHERE co.name = ?
ORDER BY p.name, c.name;
```
(4 JOINs required)

</details>

**Response Format (flat array, easy to process):**
```json
[
  {
    "position_id": 5,
    "position_name": "Regional veterinarian",
    "competency_id": 3,
    "competency_name": "Disease Prevention and Control Programs",
    "level_name": "Competent",
    "assignment_id": 4
  },
  {
    "position_id": 5,
    "position_name": "Regional veterinarian",
    "competency_id": 1,
    "competency_name": "Epidemiology",
    "level_name": "Proficient",
    "assignment_id": 12
  }
]
```

**Benefits:**
- ✅ Single database query (faster)
- ✅ One API call instead of 2-4 (reduced network overhead)
- ✅ All level names included directly from ENUM (no separate lookup)
- ✅ Real position IDs (no fragile index mapping)
- ✅ Simple to cache and optimize
- ✅ Easy to extend with additional fields
- ✅ **25% fewer JOINs** with simplified schema

**Backend Implementation:**
```javascript
// server/routes/countryManager.js
router.get("/assignments", async function (req, res) {
  const { country } = req.query;
  
  if (!country) {
    return res.status(400).send({ error: "Country parameter is required" });
  }
  
  try {
    // Using simplified schema with ENUM
    const assignments = await db(
      `SELECT 
        p.id as position_id,
        p.name as position_name,
        c.id as competency_id,
        c.name as competency_name,
        pcbc.level_required as level_name,
        pcbc.id as assignment_id
      FROM position_competency_by_country pcbc 
      JOIN positions p ON pcbc.position_id = p.id
      JOIN competencies c ON pcbc.competency_id = c.id
      JOIN countries co ON pcbc.country_id = co.id
      WHERE co.name = ?
      ORDER BY p.name, c.name`,
      [country]
    );
    
    res.json(assignments.data);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});
```

**Note:** If using the original 5-table schema with a separate `levels` table, add the JOIN:
```javascript
// Add this JOIN and field for original schema:
// JOIN levels l ON pcbc.level_required = l.id
// l.name as level_name,
```

**Frontend Processing (much simpler):**
```javascript
// Group by position on frontend if needed
const groupByPosition = (assignments) => {
  return assignments.reduce((acc, assignment) => {
    const positionKey = assignment.position_name;
    if (!acc[positionKey]) {
      acc[positionKey] = {
        position_id: assignment.position_id,
        position_name: assignment.position_name,
        competencies: []
      };
    }
    acc[positionKey].competencies.push({
      competency_id: assignment.competency_id,
      competency_name: assignment.competency_name,
      level_id: assignment.level_id,
      level_name: assignment.level_name,
      assignment_id: assignment.assignment_id
    });
    return acc;
  }, {});
};
```

### 5.2 Application Flow (Simplified)

```
1. Initial Setup
   ├─ Country (string) provided from user session
   └─ Component initializes

2. Single Data Load
   └─ GET /api/country-manager/assignments?country={name}
      └─ Returns complete dataset with all names resolved

3. Frontend Processing
   ├─ Group by position (optional, for display)
   ├─ No ID lookups needed
   └─ Direct rendering from clean data structure

4. Display
   └─ Render table directly from structured data
```

### 5.3 Key Business Rules

1. **Country Isolation:** Data scoped to country name from user session
2. **Read-Only View:** No editing capabilities
3. **Data Integrity:** All data with proper names from single source
4. **Performance:** Single optimized query with proper indexing

### 5.4 Database Optimization

**Add Index for Performance:**
```sql
-- Optimize the main query
CREATE INDEX idx_pcbc_country_lookup 
ON position_competency_by_country(country_id, position_id);

-- Ensure countries.name is indexed for JOIN
CREATE INDEX idx_countries_name 
ON countries(name);
```

---

## 6. Implementation Steps for React

### Step 1: Database Setup
1. Create all required tables (use SQL scripts from Section 2)
2. Insert sample data for competencies, levels, and roles
3. Set up foreign key constraints
4. Test database relationships

### Step 2: Backend API Development (Node.js/Express)

**Project Structure:**
```
backend/
├── server.js
├── .env
├── routes/
│   ├── competencies.js
│   └── positions.js
├── utils/
│   ├── db.js
│   └── helpers.js
└── package.json
```

**Dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "mysql2": "^3.0.0",
    "dotenv": "^16.0.0",
    "cors": "^2.8.5"
  }
}
```

**Implementation Checklist:**
- [ ] Set up Express server
- [ ] Create database connection pool
- [ ] Implement GET /api/competencies endpoint
- [ ] Implement GET /api/positions/competencies endpoint
- [ ] Implement GET /api/positions/competencies-levels endpoint
- [ ] Implement GET /api/positions endpoint
- [ ] Add error handling
- [ ] Test with Postman/Thunder Client

### Step 3: React Frontend Development

**Project Structure:**
```
frontend/
├── src/
│   ├── components/
│   │   ├── CountryManager/
│   │   │   ├── CountryManagerView.jsx
│   │   │   └── PositionsTable.jsx
│   │   └── common/
│   │       ├── Header.jsx
│   │       └── Spinner.jsx
│   ├── services/
│   │   └── api.js
│   ├── hooks/
│   │   └── useCountryManager.js
│   ├── constants/
│   │   ├── competencies.js
│   │   └── levels.js
│   ├── App.jsx
│   └── index.js
└── package.json
```

**Dependencies:**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "axios": "^1.3.0",
    "react-query": "^3.39.0"
  }
}
```

### Step 4: Component Implementation (Simplified)

#### 4.1 Create API Service

**File:** `src/services/api.js`

```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Single unified endpoint for all country manager data
  getCountryManagerData: (country) => 
    apiClient.get(`/country-manager/assignments?country=${encodeURIComponent(country)}`),
};
```

#### 4.2 Create Custom Hook

**File:** `src/hooks/useCountryManager.js`

```javascript
import { useState, useEffect } from 'react';
import { api } from '../services/api';

export const useCountryManager = (country) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    if (!country) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getCountryManagerData(country);
      setAssignments(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [country]);

  // Group assignments by position for easier rendering
  const groupedByPosition = assignments.reduce((acc, assignment) => {
    const key = assignment.position_name;
    if (!acc[key]) {
      acc[key] = {
        position_id: assignment.position_id,
        position_name: assignment.position_name,
        competencies: []
      };
    }
    acc[key].competencies.push({
      competency_id: assignment.competency_id,
      competency_name: assignment.competency_name,
      level_id: assignment.level_id,
      level_name: assignment.level_name,
    });
    return acc;
  }, {});

  return {
    assignments,           // Raw data array
    groupedByPosition,     // Grouped by position object
    positions: Object.values(groupedByPosition), // Array of positions
    loading,
    error,
    reloadData: loadData,
  };
};
```

#### 4.3 Create Main Component

**File:** `src/components/CountryManager/CountryManagerView.jsx`

```javascript
import React from 'react';
import { PositionsTable } from './PositionsTable';
import { useCountryManager } from '../../hooks/useCountryManager';

export const CountryManagerView = ({ country }) => {
  const { positions, loading, error } = useCountryManager(country);

  if (loading) return <div className="spinner">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!country) return <div className="info">No country selected</div>;

  return (
    <div className="container py-5">
      <div className="header">
        <h2>Position-Competency Assignments</h2>
        <p>Viewing assignments for {country}</p>
      </div>

      <PositionsTable positions={positions} />
    </div>
  );
};
```

**Usage Example:**

```javascript
// In your main app or route component
import { CountryManagerView } from './components/CountryManager/CountryManagerView';

// Get country from user session (provided by TFP role authentication)
const userCountry = sessionStorage.getItem('userCountry'); // e.g., "Albania"

// Render the component
<CountryManagerView country={userCountry} />
```

#### 4.4 Create Positions Table Component

**File:** `src/components/CountryManager/PositionsTable.jsx`

```javascript
import React from 'react';

export const PositionsTable = ({ positions }) => {
  if (!positions || positions.length === 0) {
    return <div className="no-data">No positions or assignments found.</div>;
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Position</th>
            <th>Assigned Competencies</th>
            <th>Required Levels</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.position_id}>
              <td className="position-name">
                {position.position_name}
              </td>
              <td>
                {position.competencies.length > 0 ? (
                  <ul className="competency-list">
                    {position.competencies.map((comp, idx) => (
                      <li key={`${comp.competency_id}-${idx}`}>
                        {comp.competency_name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">No assignments</span>
                )}
              </td>
              <td>
                {position.competencies.length > 0 ? (
                  <ul className="level-list">
                    {position.competencies.map((comp, idx) => (
                      <li key={`${comp.competency_id}-${idx}`}>
                        <span className={`level-badge level-${comp.level_id}`}>
                          {comp.level_name}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

**Key Improvements:**
- ✅ No ID lookups needed (level_name already included)
- ✅ No array index mapping (position_id from database)
- ✅ Cleaner, more readable code
- ✅ Type-safe data structure
- ✅ Easy to add styling with level-specific CSS classes

### Step 5: Styling
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (country) {
      loadData();
    }
  }, [country]);

  return {
    positions,
    competenciesByPosition,
    loading,
    error,
    reloadData: loadData,
  };
};
```
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const assignCompetency = async (positionIds, competencyId, levelId) => {
    try {
      await api.assignRequiredCompetency(
        positionIds.join(','),
        competencyId,
        levelId
      );
      await loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteCompetency = async (positionId, competencyId, levelId) => {
    try {
      await api.deleteRequiredCompetency(positionId, competencyId, levelId);
      await loadData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    positions,
    competenciesByPosition,
    loading,
    error,
    assignCompetency,
    deleteCompetency,
    reloadData: loadData,
  };
};
```

#### 4.4 Create Main Component

**File:** `src/components/CountryManager/CountryManagerView.jsx`

```javascript
import React from 'react';
import { PositionsTable } from './PositionsTable';
import { useCountryManager } from '../../hooks/useCountryManager';
import { LEVELS } from '../../constants';

export const CountryManagerView = ({ country }) => {
  const {
    positions,
    competenciesByPosition,
    loading,
    error,
  } = useCountryManager(country);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container py-5">
      <div className="header">
        <h2>Position-Competency Assignments</h2>
        <p>Viewing assignments for {country}</p>
      </div>

      <PositionsTable
        positions={positions}
        competenciesByPosition={competenciesByPosition}
        levels={LEVELS}
      />
    </div>
  );
};
```
    const result = await deleteCompetency(positionId, competencyId, levelId);
    if (!result.success) {
      alert('Failed to delete assignment');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container py-5">
      {message && (
        <div className="alert alert-info">{message}</div>
      )}

      <ConfirmationModal
        show={showModal}
        competency={COMPETENCIES[selectedCompetency]}
        level={LEVELS[selectedLevel]}
        message={message}
        onClose={() => setShowModal(false)}
        onConfirm={handleAssign}
      />

      <div className="sticky-header">
        {selectedPositions.length > 0 ? (
          <AssignmentControls
            competencies={COMPETENCIES}
            levels={LEVELS}
            selectedCompetency={selectedCompetency}
            selectedLevel={selectedLevel}
            onCompetencyChange={setSelectedCompetency}
            onLevelChange={setSelectedLevel}
            onAssign={() => setShowModal(true)}
          />
        ) : (
          <div className="position-info">
            There are {positions.length} positions.
          </div>
        )}
      </div>

      <PositionsTable
        positions={positions}
        competenciesByPosition={competenciesByPosition}
        selectedPositions={selectedPositions}
        onSelectionChange={setSelectedPositions}
        onDelete={handleDelete}
      />
    </div>
  );
};
```

**Usage Example:**

```javascript
// In your main app or route component
import { CountryManagerView } from './components/CountryManager/CountryManagerView';

// Get country from user session (provided by TFP role authentication)
const userCountry = sessionStorage.getItem('userCountry'); // e.g., "Albania"

// Render the component with country string
<CountryManagerView country={userCountry} />
```

#### 4.5 Create Positions Table Component

**File:** `src/components/CountryManager/PositionsTable.jsx`

```javascript
import React from 'react';

export const PositionsTable = ({
  positions,
  competenciesByPosition,
  levels,
}) => {
  const getCompetenciesForPosition = (positionId) => {
    return competenciesByPosition.filter(c => c.position_id === positionId);
  };

  const getLevelName = (levelId) => {
    return levels[levelId] || 'Unknown';
  };

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Position</th>
            <th>Assigned Competencies</th>
            <th>Required Levels</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position, index) => {
            const positionId = index + 1;
            const competencies = getCompetenciesForPosition(positionId);
            
            return (
              <tr key={positionId}>
                <td>{position}</td>
                <td>
                  {competencies.length > 0 ? (
                    <ul>
                      {competencies.map((comp, idx) => (
                        <li key={idx}>{comp.competency}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted">No assignments</span>
                  )}
                </td>
                <td>
                  {competencies.length > 0 ? (
                    <ul>
                      {competencies.map((comp, idx) => (
                        <li key={idx}>
                          {getLevelName(comp.level_required)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```
        </tbody>
      </table>
    </div>
  );
};
```

### Step 5: Styling

**File:** `src/components/CountryManager/CountryManager.css`
2. **Table styling** with borders and hover effects
3. **Checkbox styling** - larger, custom colors
4. **Modal overlay** with backdrop blur
5. **Button states** - disabled, hover, active
6. **Responsive design** for mobile devices

**Sample CSS (CountryManager.css):**

```css
.container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.sticky-header {
  position: sticky;
  top: 0;
  z-index: 20;
  padding: 1rem;
  background: #f9fafb;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.assignment-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.assignment-controls select {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
}

.btn-primary {
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 1rem;
}

.btn-primary:hover:not(.disabled) {
  background: #059669;
}

.btn-primary.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.table-container {
  border-top: 1px solid #e5e7eb;
}

.table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-radius: 0.5rem;
}

.table thead {
  background: #f3f4f6;
}

.table th,
.table td {
  padding: 0.75rem 1.25rem;
  text-align: center;
  border-bottom: 1px solid #e5e7eb;
}

.table th {
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  color: #6b7280;
}

.table tbody tr:hover {
  background: #f9fafb;
}

.text-muted {
  color: #9ca3af;
  font-style: italic;
}

.alert {
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 0.375rem;
}

.alert-info {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #93c5fd;
}
```

### Step 6: Testing

**Test Cases:**

1. **Data Loading:**
   - [ ] Component accepts country string as prop
   - [ ] Positions load correctly for specified country name
   - [ ] Competencies displayed properly
   - [ ] Level names shown correctly
   - [ ] Empty state handled (no positions or no assignments)

2. **Data Display:**
   - [ ] Position names displayed correctly
   - [ ] Competency names displayed correctly
   - [ ] Level names (not just IDs) displayed
   - [ ] Multiple competencies per position displayed
   - [ ] Table formatting correct and readable

3. **User Experience:**
   - [ ] Loading state shows while fetching data
   - [ ] Error state shows if data fetch fails
   - [ ] Table is responsive on different screen sizes
   - [ ] Data is clearly organized and easy to read

4. **Edge Cases:**
   - [ ] Empty positions list handled gracefully
   - [ ] Positions with no assignments show appropriate message
   - [ ] Network errors handled gracefully
   - [ ] Invalid country name handled
   - [ ] Country names with spaces/special characters handled with URL encoding
   - [ ] Large datasets display without performance issues

### Step 7: Deployment

**Environment Variables:**

```env
# Backend (.env)
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=tms_database

# Frontend (.env)
REACT_APP_API_URL=http://localhost:3000/api
```

**Build and Deploy:**
```bash
# Backend
cd backend
npm install
npm start

# Frontend
cd frontend
npm install
npm run build
npm start
```

---

## 7. Dependencies and Libraries

### 7.1 Backend Dependencies

```json
{
  "name": "tms-backend",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.2.0",
    "dotenv": "^16.0.3",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-validator": "^7.0.1"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```

**Key Libraries:**
- **express**: Web framework
- **mysql2**: MySQL driver with Promise support
- **dotenv**: Environment variable management
- **cors**: Cross-origin resource sharing
- **helmet**: Security headers
- **express-validator**: Input validation

### 7.2 Frontend Dependencies

```json
{
  "name": "tms-frontend",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.10.0",
    "axios": "^1.3.6",
    "react-query": "^3.39.3",
    "@tanstack/react-table": "^8.9.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.3.4",
    "eslint": "^8.40.0"
  }
}
```

**Key Libraries:**
- **react**: UI library
- **react-router-dom**: Client-side routing
- **axios**: HTTP client
- **react-query**: Data fetching and caching
- **@tanstack/react-table**: Advanced table functionality (optional)

### 7.3 Optional Enhancements

**UI Libraries:**
- **Material-UI** or **Ant Design**: Component library
- **Tailwind CSS**: Utility-first CSS framework
- **Styled Components**: CSS-in-JS solution

**State Management:**
- **Redux Toolkit**: Global state management
- **Zustand**: Lightweight state management
- **Jotai**: Atomic state management

**Form Handling:**
- **React Hook Form**: Form validation
- **Formik**: Form management
- **Yup**: Schema validation

**Testing:**
- **Jest**: Unit testing
- **React Testing Library**: Component testing
- **Cypress**: E2E testing

---

## Additional Notes

### Security Considerations

1. **SQL Injection Prevention:** Use parameterized queries or ORM
2. **XSS Protection:** Sanitize user inputs
3. **CSRF Protection:** Implement CSRF tokens
4. **Rate Limiting:** Prevent API abuse
5. **HTTPS Only:** Enforce secure connections
6. **Token Refresh:** Implement token refresh mechanism
7. **Password Policies:** Enforce strong passwords
8. **Audit Logging:** Log all critical operations

### Performance Optimization

1. **Database Indexing:** Add indexes on frequently queried columns
2. **Query Optimization:** Use JOINs efficiently
3. **Caching:** Implement Redis for frequently accessed data
4. **Pagination:** For large datasets
5. **Lazy Loading:** Load data on demand
6. **Code Splitting:** Split React bundles
7. **Compression:** Enable gzip compression

### Error Handling

**Backend:**
```javascript
// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});
```

**Frontend:**
```javascript
// API error interceptor
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Migration Considerations

1. **Data Migration:** Export existing data and import to new system
2. **Testing Environment:** Set up staging environment
3. **Rollback Plan:** Prepare rollback strategy
4. **User Training:** Train users on new interface
5. **Documentation:** Update user documentation
6. **Support Plan:** Prepare support team

---

## 8. Training Credit System (Additional Feature)

### 8.1 Overview

The Training Credit System is an additional feature available to Country Managers (CM role) and TFP users. It displays:
1. **Summary**: Training credit allocations per course for the country
2. **Calendar**: Upcoming training events from external JSON source
3. **Training Menu**: PDF viewer for training catalog

**Access:** Country Managers and TFP role users only

---

### 8.2 Database Schema

#### Training Credits Tables Overview

**⚠️ Important: Two Different Training Credits Tables**

The system now has two separate training credits tables:

1. **`training_credits_past`** - Historical data (read-only)
   - This is the old `training_credits` table, renamed to `training_credits_past`
   - Used only for viewing what was done in the past
   - Maintains the original simple structure with course names and credits

2. **`training_credits`** - Current/Active table
   - New structure for Phase VI
   - Allows countries to select courses they want
   - Includes detailed tracking per course with seats, spending, and status
   - This is the primary table for current operations

---

#### `training_credits_past` Table (Historical/Read-Only)

```sql
CREATE TABLE `training_credits_past` (
  `id` int NOT NULL AUTO_INCREMENT,
  `country` varchar(255) NOT NULL,
  `course_short_name` varchar(255) NOT NULL,
  `training_credits` int DEFAULT 0,
  `total_seats` int DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_country` (`country`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Sample Data:**
```sql
INSERT INTO `training_credits_past` (country, course_short_name, training_credits, total_seats) VALUES
  ('Albania', 'Real Time Training', 3, 1),
  ('Albania', 'Depopulation Workshop', 4, 2),
  ('Albania', 'FMD Emergency Preparedness', 1, 20),
  ('North Macedonia', 'Biosecurity Fundamentals', 2, 5);
```

**Key Points:**
- Uses country name (not country_id) for filtering
- `training_credits` = cost/points for the course
- `total_seats` = number of available seats for that country
- **Read-only**: For historical reference only

---

#### `training_credits` Table (Current/Active)

```sql
CREATE TABLE training_credits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country VARCHAR(100) NOT NULL,
    allocated INT DEFAULT 0,
    spent_main INT DEFAULT NULL,
    available INT DEFAULT 0,
    available_to_allocate INT DEFAULT 0,
    virtual_seats_courses VARCHAR(50) DEFAULT NULL,
    comments TEXT,

    -- Course 1.1: Real-Time training courses
    c1_1_real_time_training INT DEFAULT 0,
    c1_1_seats_avail INT DEFAULT 0,
    c1_1_seats_spent INT DEFAULT 0,
    c1_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 2.1: In-country support to national simulation exercises
    c2_1_incountry_support_nat INT DEFAULT 0,
    c2_1_seats INT DEFAULT 0,
    c2_1_spent INT DEFAULT 0,
    c2_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 2.2: Support for multi-country simulation exercises
    c2_2_multi_country_support INT DEFAULT 0,
    c2_2_seats INT DEFAULT 0,
    c2_2_spent INT DEFAULT 0,
    c2_2_status VARCHAR(20) DEFAULT NULL,

    -- Course 2.3: In-country missions to provide technical support
    c2_3_incountry_missions INT DEFAULT 0,
    c2_3_seats INT DEFAULT 0,
    c2_3_spent INT DEFAULT 0,
    c2_3_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.1: Simulation exercises for FMD/FAST disease emergencies
    c3_1_sim_exercises_fmd INT DEFAULT 0,
    c3_1_seats INT DEFAULT 0,
    c3_1_spent INT DEFAULT 0,
    c3_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.2: Dealing with psychological aspects and public perception
    c3_2_psychological_aspects INT DEFAULT 0,
    c3_2_seats INT DEFAULT 0,
    c3_2_spent INT DEFAULT 0,
    c3_2_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.3: Putting vaccination into practice
    c3_3_vaccination_practice INT DEFAULT 0,
    c3_3_seats INT DEFAULT 0,
    c3_3_spent INT DEFAULT 0,
    c3_3_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.4: Surveillance for FMD and similar transboundary animal diseases in wildlife
    c3_4_surveillance_wildlife INT DEFAULT 0,
    c3_4_seats INT DEFAULT 0,
    c3_4_spent INT DEFAULT 0,
    c3_4_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.5: Depopulation, safe disposal and cleaning and disinfection
    c3_5_depopulation INT DEFAULT 0,
    c3_5_seats INT DEFAULT 0,
    c3_5_spent INT DEFAULT 0,
    c3_5_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.6: Passive surveillance for FMD/FAST diseases workshop
    c3_6_passive_surveillance_ws INT DEFAULT 0,
    c3_6_seats INT DEFAULT 0,
    c3_6_spent INT DEFAULT 0,
    c3_6_status VARCHAR(20) DEFAULT NULL,

    -- Course 4.1: FMD laboratory training course
    c4_1_fmd_lab INT DEFAULT 0,
    c4_1_seats INT DEFAULT 0,
    c4_1_spent INT DEFAULT 0,
    c4_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 4.2: Rift Valley fever laboratory training course
    c4_2_rvf_lab INT DEFAULT 0,
    c4_2_seats INT DEFAULT 0,
    c4_2_spent INT DEFAULT 0,
    c4_2_status VARCHAR(20) DEFAULT NULL,

    -- Course 4.3: Capripoxviruses laboratory training course
    c4_3_capripox_lab INT DEFAULT 0,
    c4_3_seats INT DEFAULT 0,
    c4_3_spent INT DEFAULT 0,
    c4_3_status VARCHAR(20) DEFAULT NULL,

    -- Course 5.1: Virtual cascading course
    c5_1_virtual_cascading INT DEFAULT 0,
    c5_1_seats INT DEFAULT 0,
    c5_1_spent INT DEFAULT 0,
    c5_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 5.2: Adaptation and translation of capacity development tools
    c5_2_adaptation_tools INT DEFAULT 0,
    c5_2_seats INT DEFAULT 0,
    c5_2_spent INT DEFAULT 0,
    c5_2_status VARCHAR(20) DEFAULT NULL,

    -- Course 6.1: Passive surveillance for FMD/FAST diseases
    c6_1_passive_surveillance INT DEFAULT 0,
    c6_1_seats INT DEFAULT 0,
    c6_1_spent INT DEFAULT 0,
    c6_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 6.2: FMD Emergency Preparation Course
    c6_2_fmd_emergency_prep INT DEFAULT 0,
    c6_2_seats INT DEFAULT 0,
    c6_2_spent INT DEFAULT 0,
    c6_2_status VARCHAR(20) DEFAULT NULL,

    -- Course 6.3: FMD Investigation Training Course
    c6_3_fmd_investigation INT DEFAULT 0,
    c6_3_seats INT DEFAULT 0,
    c6_3_spent INT DEFAULT 0,
    c6_3_status VARCHAR(20) DEFAULT NULL,

    -- Course 6.4: LSD training course
    c6_4_lsd_training INT DEFAULT 0,
    c6_4_seats INT DEFAULT 0,
    c6_4_spent INT DEFAULT 0,
    c6_4_status VARCHAR(20) DEFAULT NULL,

    -- Course 6.9: RVF preparedness
    c6_9_rvf_prep INT DEFAULT 0,
    c6_9_seats INT DEFAULT 0,
    c6_9_spent INT DEFAULT 0,
    c6_9_status VARCHAR(20) DEFAULT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Key Points:**
- **Country-based allocation**: Each row represents one country's training credits
- **Overall budget tracking**: 
  - `allocated` = Total credits allocated to the country
  - `spent_main` = Total credits spent
  - `available` = Remaining credits available
  - `available_to_allocate` = Credits not yet allocated to specific courses
- **Per-course tracking**: Each course has 4 columns:
  - `c[X]_[name]` = Credits allocated to this course
  - `c[X]_seats` or `c[X]_seats_avail` = Number of seats available
  - `c[X]_seats_spent` or `c[X]_spent` = Number of seats used or credits spent
  - `c[X]_status` = Current status of the course (e.g., 'pending', 'approved', 'completed')
- **Course selection**: Countries can select which courses they want to allocate their credits to
- **18 different courses** available across 6 categories:
  1. Real-time training courses
  2. In-country and multi-country support
  3. Simulation exercises and specialized topics (6 courses)
  4. Laboratory training courses (3 courses)
  5. Virtual cascading and adaptation tools (2 courses)
  6. Surveillance and preparedness courses (5 courses)

---

### 8.3 Backend API Endpoints

#### 8.3.1 Historical Training Credits (Past Data)

**Endpoint:** `GET /api/training_credits/credits/past`

**Purpose:** Fetch historical training credit allocations for the authenticated user's country (read-only, for viewing past data)

**Authentication:** Requires user to be logged in (JWT token)

**Response:**
```json
[
  {
    "id": 1,
    "course_short_name": "Real Time Training",
    "training_credits": 3,
    "total_seats": 1
  },
  {
    "id": 2,
    "course_short_name": "Depopulation Workshop",
    "training_credits": 4,
    "total_seats": 2
  }
]
```

**Backend Implementation:**

**File:** `server/routes/api/training_credits.js`

```javascript
const express = require("express");
const router = express.Router();
const db = require("../../model/helper");
const userShouldBeLoggedIn = require("../../guards/userShouldBeLoggedIn");

// GET historical training credits (past data)
router.get("/credits/past", userShouldBeLoggedIn, async function (req, res) {
  const { user_id } = req;

  try {
    // Get user's country name
    const country_name = (
      await db(
        `SELECT name FROM users 
         JOIN countries ON users.country_id = countries.id
         WHERE users.id = ?;`,
        [user_id]
      )
    ).data[0].name;

    // Get historical training credits data
    const training_credits = (
      await db(
        `SELECT id, course_short_name, training_credits, total_seats 
         FROM training_credits_past 
         WHERE country = ?;`,
        [country_name]
      )
    ).data;

    res.send(training_credits);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
```

---

#### 8.3.2 Current Phase VI Training Credits

**Endpoint:** `GET /api/training_credits/phase-vi`

**Purpose:** Fetch current Phase VI training credit allocations for the authenticated user's country (includes course selection and detailed tracking)

**Authentication:** Requires user to be logged in (JWT token)

**Response:**
```json
{
  "id": 1,
  "country": "Albania",
  "allocated": 100,
  "spent_main": 35,
  "available": 65,
  "available_to_allocate": 15,
  "virtual_seats_courses": "5",
  "comments": "Priority on FMD courses",
  "c1_1_real_time_training": 10,
  "c1_1_seats_avail": 2,
  "c1_1_seats_spent": 1,
  "c1_1_status": "active",
  "c2_1_incountry_support_nat": 15,
  "c2_1_seats": 1,
  "c2_1_spent": 15,
  "c2_1_status": "completed",
  // ... other courses ...
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-02-11T14:22:00.000Z"
}
```

**Backend Implementation:**

**File:** `server/routes/api/training_credits.js`

```javascript
// GET current Phase VI training credits
router.get("/phase-vi", userShouldBeLoggedIn, async function (req, res) {
  const { user_id } = req;

  try {
    // Get user's country name
    const country_name = (
      await db(
        `SELECT name FROM users 
         JOIN countries ON users.country_id = countries.id
         WHERE users.id = ?;`,
        [user_id]
      )
    ).data[0].name;

    // Get Phase VI training credits data
    const phase_vi_credits = (
      await db(
        `SELECT * FROM phase_vi_training_credits 
         WHERE country = ?;`,
        [country_name]
      )
    ).data;

    // Return single record (one row per country) or null if not found
    res.send(phase_vi_credits.length > 0 ? phase_vi_credits[0] : null);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
```

**Register Route in `server/app.js`:**
```javascript
const trainingCreditsRouter = require("./routes/api/training_credits");
app.use("/api/training_credits", trainingCreditsRouter);
```

---

### 8.4 Frontend Components

#### Main Component

**File:** `src/views/TrainingCredit.vue` (Vue) or `src/views/TrainingCredit.jsx` (React)

**Features:**
1. **Three Tabs:**
   - Summary: Table of credits and seats
   - Calendar: Training events calendar
   - Training Menu: PDF viewer

2. **External Data Sources:**
   - Calendar events: JSON from S3 bucket
   - Training menu: PDF from S3 bucket

**React Implementation:**

**File:** `src/components/TrainingCredit/TrainingCreditView.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import { parse, format } from 'date-fns';
import { api } from '../../services/api';

export const TrainingCreditView = () => {
  const [view, setView] = useState('summary'); // summary, calendar, training-menu
  const [loading, setLoading] = useState(false);
  const [countryCredits, setCountryCredits] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const CALENDAR_URL = "https://trainingevents.s3.eu-north-1.amazonaws.com/2024_vL.json";
  const TRAINING_MENU_URL = 'https://tom-documents.s3.eu-north-1.amazonaws.com/TrainingMenu+-+2023-2025.pdf';

  const months = [
    { value: '01', name: 'January' },
    { value: '02', name: 'February' },
    { value: '03', name: 'March' },
    { value: '04', name: 'April' },
    { value: '05', name: 'May' },
    { value: '06', name: 'June' },
    { value: '07', name: 'July' },
    { value: '08', name: 'August' },
    { value: '09', name: 'September' },
    { value: '10', name: 'October' },
    { value: '11', name: 'November' },
    { value: '12', name: 'December' },
  ];

  useEffect(() => {
    loadCredits();
    loadCalendarEvents();
  }, []);

  // Load historical training credits (past data)
  const loadCredits = async () => {
    setLoading(true);
    try {
      const data = await api.getHistoricalCredits(); // Calls GET /api/training_credits/credits/past
      setCountryCredits(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Alternative: Load current Phase VI training credits
  const loadPhaseVICredits = async () => {
    setLoading(true);
    try {
      const data = await api.getPhaseVICredits(); // Calls GET /api/training_credits/phase-vi
      // Process Phase VI data structure...
      // Note: This returns a single object with all courses, not an array
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const loadCalendarEvents = async () => {
    try {
      const response = await fetch(CALENDAR_URL);
      const data = await response.json();
      
      // Format dates
      const formatted = data.map(event => {
        const parsedStartDate = parse(event.Start_Date, 'dd-MMM-yy', new Date());
        const parsedEndDate = parse(event.End_Date, 'dd-MMM-yy', new Date());
        
        return {
          ...event,
          readableStartDate: event.Start_Date,
          readableEndDate: event.End_Date,
          Start_Date: format(parsedStartDate, 'yyyy-MM-dd'),
          End_Date: format(parsedEndDate, 'yyyy-MM-dd')
        };
      });
      
      setCalendarEvents(formatted);
      setFilteredEvents(formatted);
    } catch (err) {
      console.error(err);
    }
  };

  const filterEventsByMonth = (month) => {
    setSelectedMonth(month);
    if (month) {
      const filtered = calendarEvents.filter(event => {
        const eventMonth = new Date(event.Start_Date).getMonth() + 1;
        return eventMonth.toString().padStart(2, '0') === month;
      });
      setFilteredEvents(filtered);
    } else {
      setFilteredEvents(calendarEvents);
    }
  };

  if (loading) return <div className="spinner">Loading...</div>;

  return (
    <div className="container min-h-screen py-8">
      {/* Tabs */}
      <div className="flex space-x-5 border-b mb-5 font-medium">
        <button
          className={`py-4 px-2 ${
            view === 'summary'
              ? 'border-b-4 border-green-primary text-green-primary'
              : 'text-gray-500'
          }`}
          onClick={() => setView('summary')}
        >
          Summary
        </button>
        <button
          className={`py-4 px-2 ${
            view === 'calendar'
              ? 'border-b-4 border-green-primary text-green-primary'
              : 'text-gray-500'
          }`}
          onClick={() => setView('calendar')}
        >
          Calendar
        </button>
        <button
          className={`py-4 px-2 ${
            view === 'training-menu'
              ? 'border-b-4 border-green-primary text-green-primary'
              : 'text-gray-500'
          }`}
          onClick={() => setView('training-menu')}
        >
          Training Menu
        </button>
      </div>

      {/* Summary Tab */}
      {view === 'summary' && (
        <div className="overflow-x-auto">
          <table className="w-full border bg-white">
            <thead>
              <tr className="bg-gray-100 text-gray-700 text-xs font-medium uppercase">
                <th className="text-left px-10 py-3">Course</th>
                <th className="text-center px-5 py-3">Cost</th>
                <th className="text-center px-5 py-3">Seats</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {countryCredits.map((credit) => (
                <tr key={credit.id} className="text-center hover:bg-gray-50">
                  <td className="px-10 py-3 text-left">{credit.course_short_name}</td>
                  <td className="px-5 py-3">{credit.training_credits}</td>
                  <td className="px-5 py-3">{credit.total_seats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Calendar Tab */}
      {view === 'calendar' && (
        <div>
          <select
            value={selectedMonth || ''}
            onChange={(e) => filterEventsByMonth(e.target.value || null)}
            className="w-full border rounded px-4 py-2 mb-4"
          >
            <option value="">Full Year</option>
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.name}
              </option>
            ))}
          </select>

          <table className="w-full border bg-white">
            <thead>
              <tr className="bg-gray-100 text-gray-700 text-xs font-medium uppercase">
                <th className="text-left px-10 py-3">Course Name</th>
                <th className="text-center px-5 py-3">Start Date</th>
                <th className="text-center px-5 py-3">End Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEvents.map((event, idx) => (
                <tr key={idx} className="text-center hover:bg-gray-50">
                  <td className="px-10 py-3 text-left">{event.vLearning_Course_Name}</td>
                  <td className="px-5 py-3">{event.readableStartDate}</td>
                  <td className="px-5 py-3">{event.readableEndDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Training Menu Tab */}
      {view === 'training-menu' && (
        <div className="mt-5">
          <a 
            href="https://www.fao.org/eufmd/training/en/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 underline mb-4 inline-block"
          >
            View Online Training Menu
          </a>
          
          <div className="mt-4">
            <embed
              src={TRAINING_MENU_URL}
              type="application/pdf"
              width="100%"
              height="800px"
            />
          </div>
        </div>
      )}
    </div>
  );
};
```

#### API Service Method

**File:** `src/services/api.js`

```javascript
export const api = {
  // ... other methods ...

  // Training Credits - Historical Data (Past)
  getHistoricalCredits: async () => {
    const response = await apiClient.get('/training_credits/credits/past');
    return response.data;
  },

  // Training Credits - Current Phase VI
  getPhaseVICredits: async () => {
    const response = await apiClient.get('/training_credits/phase-vi');
    return response.data;
  },
};
```

**Note:** The historical credits endpoint returns an array of course objects, while the Phase VI endpoint returns a single object with all course data as properties.

---

### 8.5 Route Configuration

**React Router:**

```javascript
// src/App.jsx or routes file
import { TrainingCreditView } from './components/TrainingCredit/TrainingCreditView';

// In routes array:
{
  path: '/training-credits',
  element: <TrainingCreditView />,
  meta: {
    requiresAuth: true,
    roles: ['CM', 'TFP'] // Country Manager and TFP only
  }
}
```

---

### 8.6 Key Features

1. **Country-Specific Data:**
   - Automatically filters by authenticated user's country
   - No need to pass country parameter

2. **External Data Integration:**
   - Calendar events loaded from S3 JSON file
   - Training menu PDF loaded from S3
   - Data can be updated without code changes

3. **Month Filtering:**
   - Filter calendar events by month
   - Default view shows full year

4. **PDF Viewer:**
   - Embedded PDF viewer for training menu
   - Can use libraries like `react-pdf` or `vue-pdf-embed`

---

### 8.7 Migration Notes

**Differences from Country Manager:**
- ✅ Already uses country name (not country_id)
- ✅ Simpler data structure (no joins needed)
- ✅ External data sources (S3) - no schema changes
- ⚠️ Requires authentication (uses JWT token)
- ⚠️ Role-based access (CM and TFP only)

**Database Migration:**
```sql
-- Rename old table to training_credits_past
ALTER TABLE training_credits RENAME TO training_credits_past;

-- Create new Phase VI training credits table
CREATE TABLE phase_vi_training_credits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country VARCHAR(100) NOT NULL,
    allocated INT DEFAULT 0,
    spent_main INT DEFAULT NULL,
    available INT DEFAULT 0,
    available_to_allocate INT DEFAULT 0,
    virtual_seats_courses VARCHAR(50) DEFAULT NULL,
    comments TEXT,

    -- Course 1.1: Real-Time training courses
    c1_1_real_time_training INT DEFAULT 0,
    c1_1_seats_avail INT DEFAULT 0,
    c1_1_seats_spent INT DEFAULT 0,
    c1_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 2.1: In-country support to national simulation exercises
    c2_1_incountry_support_nat INT DEFAULT 0,
    c2_1_seats INT DEFAULT 0,
    c2_1_spent INT DEFAULT 0,
    c2_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 2.2: Support for multi-country simulation exercises
    c2_2_multi_country_support INT DEFAULT 0,
    c2_2_seats INT DEFAULT 0,
    c2_2_spent INT DEFAULT 0,
    c2_2_status VARCHAR(20) DEFAULT NULL,

    -- Course 2.3: In-country missions to provide technical support
    c2_3_incountry_missions INT DEFAULT 0,
    c2_3_seats INT DEFAULT 0,
    c2_3_spent INT DEFAULT 0,
    c2_3_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.1: Simulation exercises for FMD/FAST disease emergencies
    c3_1_sim_exercises_fmd INT DEFAULT 0,
    c3_1_seats INT DEFAULT 0,
    c3_1_spent INT DEFAULT 0,
    c3_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.2: Dealing with psychological aspects and public perception
    c3_2_psychological_aspects INT DEFAULT 0,
    c3_2_seats INT DEFAULT 0,
    c3_2_spent INT DEFAULT 0,
    c3_2_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.3: Putting vaccination into practice
    c3_3_vaccination_practice INT DEFAULT 0,
    c3_3_seats INT DEFAULT 0,
    c3_3_spent INT DEFAULT 0,
    c3_3_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.4: Surveillance for FMD and similar transboundary animal diseases in wildlife
    c3_4_surveillance_wildlife INT DEFAULT 0,
    c3_4_seats INT DEFAULT 0,
    c3_4_spent INT DEFAULT 0,
    c3_4_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.5: Depopulation, safe disposal and cleaning and disinfection
    c3_5_depopulation INT DEFAULT 0,
    c3_5_seats INT DEFAULT 0,
    c3_5_spent INT DEFAULT 0,
    c3_5_status VARCHAR(20) DEFAULT NULL,

    -- Course 3.6: Passive surveillance for FMD/FAST diseases workshop
    c3_6_passive_surveillance_ws INT DEFAULT 0,
    c3_6_seats INT DEFAULT 0,
    c3_6_spent INT DEFAULT 0,
    c3_6_status VARCHAR(20) DEFAULT NULL,

    -- Course 4.1: FMD laboratory training course
    c4_1_fmd_lab INT DEFAULT 0,
    c4_1_seats INT DEFAULT 0,
    c4_1_spent INT DEFAULT 0,
    c4_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 4.2: Rift Valley fever laboratory training course
    c4_2_rvf_lab INT DEFAULT 0,
    c4_2_seats INT DEFAULT 0,
    c4_2_spent INT DEFAULT 0,
    c4_2_status VARCHAR(20) DEFAULT NULL,

    -- Course 4.3: Capripoxviruses laboratory training course
    c4_3_capripox_lab INT DEFAULT 0,
    c4_3_seats INT DEFAULT 0,
    c4_3_spent INT DEFAULT 0,
    c4_3_status VARCHAR(20) DEFAULT NULL,

    -- Course 5.1: Virtual cascading course
    c5_1_virtual_cascading INT DEFAULT 0,
    c5_1_seats INT DEFAULT 0,
    c5_1_spent INT DEFAULT 0,
    c5_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 5.2: Adaptation and translation of capacity development tools
    c5_2_adaptation_tools INT DEFAULT 0,
    c5_2_seats INT DEFAULT 0,
    c5_2_spent INT DEFAULT 0,
    c5_2_status VARCHAR(20) DEFAULT NULL,

    -- Course 6.1: Passive surveillance for FMD/FAST diseases
    c6_1_passive_surveillance INT DEFAULT 0,
    c6_1_seats INT DEFAULT 0,
    c6_1_spent INT DEFAULT 0,
    c6_1_status VARCHAR(20) DEFAULT NULL,

    -- Course 6.2: FMD Emergency Preparation Course
    c6_2_fmd_emergency_prep INT DEFAULT 0,
    c6_2_seats INT DEFAULT 0,
    c6_2_spent INT DEFAULT 0,
    c6_2_status VARCHAR(20) DEFAULT NULL,

    -- Course 6.3: FMD Investigation Training Course
    c6_3_fmd_investigation INT DEFAULT 0,
    c6_3_seats INT DEFAULT 0,
    c6_3_spent INT DEFAULT 0,
    c6_3_status VARCHAR(20) DEFAULT NULL,

    -- Course 6.4: LSD training course
    c6_4_lsd_training INT DEFAULT 0,
    c6_4_seats INT DEFAULT 0,
    c6_4_spent INT DEFAULT 0,
    c6_4_status VARCHAR(20) DEFAULT NULL,

    -- Course 6.9: RVF preparedness
    c6_9_rvf_prep INT DEFAULT 0,
    c6_9_seats INT DEFAULT 0,
    c6_9_spent INT DEFAULT 0,
    c6_9_status VARCHAR(20) DEFAULT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_country` (`country`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```
## 9. Course Completion to Competency Level Mapping

### 9.1 Overview

The TMS-pilot application uses a sophisticated system to automatically calculate a learner's current competency level based on their completed courses. This system is the core business logic that determines professional progression through the competency framework.

**Key Concepts:**
- **Competency Levels**: 5 standardized levels (Awareness, Beginner, Competent, Proficient, Expert)
- **Course Bundles**: Courses are grouped into bundles within each competency level
- **Bundle Completion**: Different levels have different bundle requirements
- **Sequential Progression**: Levels must be completed sequentially (can't achieve Level 4 without completing Levels 1-3)
- **Automatic Calculation**: Happens client-side when learner data is loaded

---

### 9.2 Database Structure

#### Core Tables

**`programs` Table** - Links courses to competencies and levels
```sql
CREATE TABLE programs (
  id INT PRIMARY KEY,
  course_id INT,           -- References the course
  category_id INT,         -- Course category identifier
  competency_id INT,       -- References competencies table
  level_id INT,            -- References levels table (1-5)
  bundleCode INT,          -- Bundle identifier within a level
  country_id INT,          -- Country-specific assignments
  -- other fields...
);
```

**`enrollments` Table** - Tracks learner course enrollment and completion
```sql
CREATE TABLE enrollments (
  id INT PRIMARY KEY,
  user_id INT,             -- References the learner
  course_id INT,           -- References the course
  category_id INT,         -- Course category (used for matching)
  status VARCHAR(50),      -- 'enrolled', 'in-progress', 'completed'
  progress INT,            -- 0-100 percentage
  time_enrolled DATETIME,
  time_completed DATETIME,
  -- other fields...
);
```

**`levels` Table** - Defines competency levels
```sql
CREATE TABLE levels (
  id INT PRIMARY KEY,
  name VARCHAR(50),        -- 'Awareness', 'Beginner', 'Competent', 'Proficient', 'Expert'
  level_number INT,        -- 1, 2, 3, 4, 5
  -- other fields...
);
```

---

### 9.3 Level Calculation Logic

#### 9.3.1 Core Algorithm

The calculation is performed in `client/src/services/processData.js`:

```javascript
// competency levels mapping
const levelNames = {
  1: "Awareness",
  2: "Beginner",
  3: "Competent",
  4: "Proficient",
  5: "Expert",
};

// Main processing function
export function process(learners, enrollments, courses, competencies, currentLevels) {
  learners.forEach((learner) => {
    // Filter enrollments for this specific learner
    learner.enrollments = enrollments.filter((e) => e.user_id === learner.id);

    // Get competencies required for this learner's position
    learner.competencies = competencies[learner.position] 
      ? competencies[learner.position].map((e) => ({ ...e }))
      : [];

    // Calculate current level for each competency
    learner.competencies.forEach((competency) => {
      competency.levels = {};

      // Process each level in the competency
      for (let level in courses[competency.name]) {
        if (+level <= competency.required_level || +level <= 5) {
          let levelProgress = 0;
          let bundleCourses = new Map(); // Tracks which bundles are completed

          // Check all courses in this level
          Object.keys(courses[competency.name][level]).forEach((bundle) => {
            courses[competency.name][level][bundle].forEach((course) => {
              // Find if learner is enrolled in this course
              let enrollment = learner.enrollments.find(
                (e) => e.category_id === course.category_id
              );

              if (enrollment) {
                // Apply competency-specific logic
                // (See section 9.3.2 for detailed rules)
                
                // Example: Check if course is completed
                if (enrollment.status.toLowerCase() === "completed") {
                  // Track bundle completion
                  bundleCourses.set(course.bundleCode, course.category_id);
                  
                  // Check if all required bundles are completed
                  if (allBundlesCompleted(bundleCourses, requiredBundles)) {
                    levelProgress = 100;
                  }
                }
              }
            });
          });

          // Store level progress
          competency.levels[level] = {
            levelProgress: levelProgress,
          };
        }
      }

      // Determine highest completed level
      let completedLevels = [];
      let current_level = 0;

      for (let level in competency.levels) {
        if (competency.levels[level].levelProgress < 100) break;
        completedLevels.push(level);
      }

      // Store highest completed level as current level
      if (completedLevels.length) {
        current_level = Math.max(...completedLevels);
      }

      // Store current level on competency
      competency.current_level = current_level;

      // Determine competency status
      competency.status = 
        competency.current_level >= competency.required_level
          ? "Completed"
          : "Open";
    });
  });

  return learners;
}
```

---

#### 9.3.2 Competency-Specific Rules

Each competency has unique requirements for level completion. Here are the specific rules:

##### **Epidemiology**

```javascript
if (course.competency === "Epidemiology") {
  // Level 2 - Single Bundle (Simple)
  if (course.level === 2) {
    if (
      course.category_id === 1 ||
      course.category_id === 2 ||
      course.category_id === 3 ||
      course.category_id === 5 ||
      course.category_id === 11
    ) {
      if (enrollment.status.toLowerCase() === "completed") {
        levelProgress = 100; // Complete any course from these categories
      }
    }
  }

  // Level 3 - Two Bundles Required
  else if (course.level === 3) {
    if (course.bundleCode === 1) {
      if (
        course.category_id === 1 ||
        course.category_id === 2 ||
        course.category_id === 3 ||
        course.category_id === 5
      ) {
        if (enrollment.status.toLowerCase() === "completed") {
          bundleCourses.set(course.bundleCode, course.category_id);
        }
      }
    }

    if (course.bundleCode === 2) {
      if (course.category_id === 11) {
        if (enrollment.status.toLowerCase() === "completed") {
          bundleCourses.set(course.bundleCode, course.category_id);
        }
      }
    }

    // Check if both bundles are completed
    if (bundleCourses.has(1) && bundleCourses.has(2)) {
      levelProgress = 100;
    }
  }

  // Level 4 - Four Bundles Required
  else if (course.level === 4) {
    // Similar logic for 4 bundles
    // Must complete courses from all 4 bundles
    if (bundleCourses.has(1) && 
        bundleCourses.has(2) && 
        bundleCourses.has(3) && 
        bundleCourses.has(4)) {
      levelProgress = 100;
    }
  }
}
```

##### **Transboundary Animal Diseases**

```javascript
if (course.competency === "Transboundary Animal Diseases") {
  // Level 1 - Single Bundle
  if (course.level === 1) {
    if (
      course.category_id === 1 ||
      course.category_id === 2 ||
      course.category_id === 3 ||
      course.category_id === 5 ||
      course.category_id === 11
    ) {
      if (enrollment.status.toLowerCase() === "completed") {
        levelProgress = 100;
      }
    }
  }

  // Level 2 - Two Bundles Required
  else if (course.level === 2) {
    if (course.bundleCode === 1) {
      if (course.category_id === 1 || course.category_id === 3) {
        if (enrollment.status.toLowerCase() === "completed") {
          bundleCourses.set(course.bundleCode, course.category_id);
        }
      }
    }

    if (course.bundleCode === 2) {
      if (course.category_id === 2 || course.category_id === 5) {
        if (enrollment.status.toLowerCase() === "completed") {
          bundleCourses.set(course.bundleCode, course.category_id);
        }
      }
    }

    if (bundleCourses.has(1) && bundleCourses.has(2)) {
      levelProgress = 100;
    }
  }

  // Level 3 - Six Bundles Required (Most Complex)
  else if (course.level === 3) {
    // Bundle 1: Categories 1 or 3
    // Bundle 2: Category 2
    // Bundle 3: Category 5
    // Bundle 4: Category 12
    // Bundle 5: Category 14
    // Bundle 6: Category 11
    
    if (bundleCourses.has(1) && 
        bundleCourses.has(2) && 
        bundleCourses.has(3) && 
        bundleCourses.has(4) && 
        bundleCourses.has(5) && 
        bundleCourses.has(6)) {
      levelProgress = 100;
    }
  }

  // Level 4 - Single Specific Category
  else if (course.level === 4) {
    if (course.category_id === 13) {
      if (enrollment.status.toLowerCase() === "completed") {
        levelProgress = 100;
      }
    }
  }
}
```

##### **Animal Welfare**

```javascript
if (course.competency === "Animal Welfare") {
  // Levels 1, 3, and 4 - Specific Course Required
  if (
    course.level === 1 ||
    course.level === 3 ||
    course.level === 4
  ) {
    if (
      course.category_id === 20 &&
      course.course === "Depopulation, Disposal and Cleaning and Disinfection – From Theory to Practice"
    ) {
      if (enrollment.status.toLowerCase() === "completed") {
        levelProgress = 100;
      }
    }
  }
}
```

##### **Emergency Preparedness**

```javascript
if (course.competency === "Emergency Preparedness") {
  // Level 1 - Multiple Categories Accepted
  if (course.level === 1) {
    if (
      course.category_id === 1 ||
      course.category_id === 2 ||
      course.category_id === 3 ||
      course.category_id === 5 ||
      course.category_id === 10
    ) {
      if (enrollment.status.toLowerCase() === "completed") {
        levelProgress = 100;
      }
    }
  }

  // Level 4 - Specific Category
  if (course.level === 4) {
    if (course.category_id === 10) {
      if (enrollment.status.toLowerCase() === "completed") {
        levelProgress = 100;
      }
    }
  }

  // Level 5 - Expert Level
  if (course.level === 5) {
    if (course.category_id === 30) {
      if (enrollment.status.toLowerCase() === "completed") {
        levelProgress = 100;
      }
    }
  }
}
```

##### **Risk Analysis**

```javascript
if (course.competency === "Risk Analysis") {
  // Level 4 - Specific Category
  if (course.level === 4) {
    if (course.category_id === 25) {
      if (enrollment.status.toLowerCase() === "completed") {
        levelProgress = 100;
      }
    }
  }
}
```

---

### 9.4 Key Implementation Details

#### 9.4.1 Bundle Tracking with Map

The system uses a JavaScript `Map` to track which bundles have completed courses:

```javascript
let bundleCourses = new Map();

// When a course is completed, register its bundle
bundleCourses.set(course.bundleCode, course.category_id);

// Check if all required bundles are completed
if (bundleCourses.has(1) && bundleCourses.has(2)) {
  levelProgress = 100;
}
```

**Why use a Map?**
- Prevents duplicate counting if multiple courses in same bundle are completed
- Efficient O(1) lookups to check bundle completion
- Keys are bundle codes, values are category IDs

---

#### 9.4.2 Sequential Level Progression

Levels must be completed in order:

```javascript
let completedLevels = [];
let current_level = 0;

// Stop at first incomplete level
for (let level in competency.levels) {
  if (competency.levels[level].levelProgress < 100) break;
  completedLevels.push(level);
}

// Highest completed level becomes current level
if (completedLevels.length) {
  current_level = Math.max(...completedLevels);
}
```

**Example:**
- ✅ Levels 1, 2, 3 at 100% → current_level = 3
- ❌ Levels 1 (100%), 2 (50%), 3 (100%) → current_level = 1 (stops at first incomplete)

---

#### 9.4.3 Course Matching by Category ID

Enrollments are matched to program courses by `category_id`, not `course_id`:

```javascript
let enrollment = learner.enrollments.find(
  (e) => e.category_id === course.category_id
);
```

**Why category_id?**
- Multiple course instances can belong to same category
- More flexible for course variations
- Allows grouping of similar training content

---

### 9.5 Data Flow

```
1. Backend API provides:
   ├── Learner enrollments (with status and category_id)
   ├── Courses grouped by competency → level → bundle
   └── Competency requirements for learner's position

2. Frontend processes data:
   ├── Filter enrollments for current learner
   ├── For each competency required:
   │   ├── For each level (1-5):
   │   │   ├── Check all bundles in that level
   │   │   ├── Match courses to enrollments by category_id
   │   │   ├── Apply competency-specific completion rules
   │   │   └── Calculate levelProgress (0-100%)
   │   ├── Find highest completed level (levelProgress = 100)
   │   └── Set as current_level
   └── Determine competency status (Completed/Open)

3. Display in UI:
   ├── Show current level for each competency
   ├── Show progress percentage for each level
   └── Show overall competency status
```

---

### 9.6 Backend API for Courses

**Endpoint:** `GET /api/courses/:country`

**Purpose:** Fetch all courses grouped by competency, level, and bundle

**File:** `server/routes/api/courses.js`

```javascript
router.get("/:country", async function (req, res) {
  try {
    const { country } = req.params;

    // Fetch courses with all related data
    const courses = (
      await db(
        `SELECT 
          programs.id,
          programs.bundleCode,
          categories.id as category_id,
          categories.category_name as course,
          competencies.name as competency,
          levels.level_number as level
        FROM programs 
        INNER JOIN categories ON programs.category_id = categories.id
        INNER JOIN competencies ON programs.competency_id = competencies.id
        INNER JOIN levels ON programs.level_id = levels.id 
        WHERE programs.country_id = ${country};`
      )
    ).data;

    // Group courses by competency
    const coursesByCompetency = groupBy(courses, "competency");

    // Group courses by level within each competency
    for (let competency in coursesByCompetency) {
      coursesByCompetency[competency] = groupBy(
        coursesByCompetency[competency], 
        "level"
      );
    }

    // Further group courses by bundle within each level
    for (let competency in coursesByCompetency) {
      for (let level in coursesByCompetency[competency]) {
        coursesByCompetency[competency][level] = groupBy(
          coursesByCompetency[competency][level], 
          "bundleCode"
        );
      }
    }

    res.send(coursesByCompetency);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});
```

**Response Structure:**
```json
{
  "Epidemiology": {
    "1": {
      "1": [
        {
          "id": 123,
          "bundleCode": 1,
          "category_id": 1,
          "course": "FMD Introduction",
          "competency": "Epidemiology",
          "level": 1
        }
      ]
    },
    "2": {
      "1": [ /* courses */ ]
    }
  },
  "Transboundary Animal Diseases": {
    /* similar structure */
  }
}
```

---

### 9.7 Implementation Considerations for React

When implementing this in a React application:

#### 9.7.1 Processing Service

Create a separate service file (`services/processLearnerData.js`):

```javascript
// Level name mapping
export const LEVEL_NAMES = {
  1: "Awareness",
  2: "Beginner",
  3: "Competent",
  4: "Proficient",
  5: "Expert",
};

// Main processing function
export const calculateCompetencyLevels = (
  learner,
  enrollments,
  courses,
  competencies
) => {
  // Filter enrollments for this learner
  const learnerEnrollments = enrollments.filter(
    (e) => e.user_id === learner.id
  );

  // Get competencies for learner's position
  const learnerCompetencies = competencies[learner.position] || [];

  // Process each competency
  return learnerCompetencies.map((competency) => {
    const levels = {};

    // Calculate progress for each level
    Object.entries(courses[competency.name] || {}).forEach(([level, bundles]) => {
      if (+level <= competency.required_level || +level <= 5) {
        const levelProgress = calculateLevelProgress(
          learnerEnrollments,
          bundles,
          competency.name,
          +level
        );

        levels[level] = {
          levelProgress,
          name: LEVEL_NAMES[level],
          levelNumber: +level,
        };
      }
    });

    // Find current level
    const currentLevel = findHighestCompletedLevel(levels);

    return {
      ...competency,
      levels,
      current_level: currentLevel,
      status: currentLevel >= competency.required_level ? "Completed" : "Open",
    };
  });
};

// Helper: Calculate level progress based on bundle completion
const calculateLevelProgress = (enrollments, bundles, competencyName, level) => {
  let progress = 0;
  const completedBundles = new Map();

  Object.entries(bundles).forEach(([bundleCode, courses]) => {
    courses.forEach((course) => {
      const enrollment = enrollments.find(
        (e) => e.category_id === course.category_id
      );

      if (enrollment && enrollment.status.toLowerCase() === "completed") {
        // Apply competency-specific logic here
        // (Use switch statement or strategy pattern)
        completedBundles.set(+bundleCode, course.category_id);
      }
    });
  });

  // Check if all required bundles are completed
  progress = checkBundleCompletion(
    competencyName,
    level,
    completedBundles
  );

  return progress;
};

// Helper: Find highest completed level
const findHighestCompletedLevel = (levels) => {
  const completedLevels = [];
  
  for (let level in levels) {
    if (levels[level].levelProgress < 100) break;
    completedLevels.push(+level);
  }

  return completedLevels.length ? Math.max(...completedLevels) : 0;
};
```

#### 9.7.2 React Hook Usage

```javascript
import { useMemo } from 'react';
import { calculateCompetencyLevels } from '../services/processLearnerData';

export const useLearnerProgress = (learner, enrollments, courses, competencies) => {
  const processedCompetencies = useMemo(() => {
    if (!learner || !enrollments.length || !courses) return [];
    
    return calculateCompetencyLevels(
      learner,
      enrollments,
      courses,
      competencies
    );
  }, [learner, enrollments, courses, competencies]);

  return processedCompetencies;
};
```

---

### 9.8 Testing the Calculation

#### Test Cases

**Test Case 1: Simple Level Completion**
```javascript
// Given: Learner completes one course in category 1
// When: Course belongs to Level 1, Epidemiology
// Then: Level 1 progress = 100%, current_level = 1
```

**Test Case 2: Multi-Bundle Level**
```javascript
// Given: Learner completes courses in categories 1 and 11
// When: Both courses map to different bundles in Level 3, Epidemiology
// Then: Level 3 progress = 100%, current_level = 3 (if Levels 1-2 complete)
```

**Test Case 3: Incomplete Middle Level**
```javascript
// Given: Learner completes Levels 1 and 3 but not Level 2
// When: Calculating current level
// Then: current_level = 1 (progression stops at first incomplete level)
```

**Test Case 4: Six-Bundle Requirement**
```javascript
// Given: Learner completes 5 out of 6 required bundles
// When: Level 3, Transboundary Animal Diseases
// Then: Level 3 progress < 100%, level not completed
```

---

### 9.9 Common Pitfalls and Solutions

#### Pitfall 1: Using course_id instead of category_id
**Problem:** Enrollments don't match to courses  
**Solution:** Always match by `category_id` in enrollment lookups

#### Pitfall 2: Not checking status === "completed"
**Problem:** In-progress courses count toward level completion  
**Solution:** Always verify `enrollment.status.toLowerCase() === "completed"`

#### Pitfall 3: Forgetting bundle requirements
**Problem:** Treating all levels as single-course completion  
**Solution:** Implement Map-based bundle tracking for multi-bundle levels

#### Pitfall 4: Case sensitivity in status checks
**Problem:** "Completed" !== "completed"  
**Solution:** Always use `.toLowerCase()` for status comparisons

#### Pitfall 5: Non-sequential level completion
**Problem:** Allowing Level 4 completion without Level 3  
**Solution:** Use `break` in loop when first incomplete level is found

---

### 9.10 Summary

The course-to-competency-level mapping system is built on:

1. **Hierarchical Data Structure**: Competency → Level → Bundle → Courses
2. **Category-Based Matching**: Enrollments matched to courses via `category_id`
3. **Competency-Specific Rules**: Each competency has unique bundle requirements
4. **Bundle Completion Tracking**: Map structure prevents duplicate counting
5. **Sequential Progression**: Levels completed in order from 1 to 5
6. **Client-Side Calculation**: Processed in frontend for immediate feedback
7. **Status-Driven Logic**: Only "completed" courses count toward levels

This approach provides flexibility for different professional development paths while maintaining precise tracking of training progress across the competency framework.

---

## Conclusion

This guide provides a comprehensive overview of both the Country Manager view and Training Credit System functionality, including:

- Complete database schema with relationships
- All backend API endpoints with SQL queries
- Frontend component structure and logic
- Step-by-step implementation guide for React
- Security and performance considerations
- Testing strategies and deployment steps
- Detailed course-to-competency-level calculation logic

The extraction focuses on the core functionality while maintaining the original business logic and data flow. The React implementation follows modern best practices with hooks, context, and functional components.

---

**Document Version:** 1.2  
**Last Updated:** February 11, 2026  
**Author:** TMS Pilot Development Team

---