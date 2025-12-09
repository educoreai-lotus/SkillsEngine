### Step 7 – AI Query Builder for Unified Endpoint

This document describes the **AI-based Query Builder** that fills `response.data` for the Unified Data Exchange Protocol.

The goal is to let Skills Engine dynamically build and execute queries based on:
- the **incoming request payload** (inputs / filters),
- the **migration file** (canonical schema + data model),
- the **requested output shape** defined in `response.data`.

The AI Query Builder runs as a separate service layer and uses an LLM (e.g. **Gemini**) via API.

---

### 1. Responsibilities

- **Input understanding**:
  - Read the `payload` object from the unified endpoint request (context, filters, IDs).
  - Read the `response.data` object (the exact fields and nested structure the caller wants populated).
  - Read the migration file to understand:
    - entities, fields, and relationships,
    - where each field is stored (tables/collections),
    - how to join or aggregate data.

- **Query planning & generation**:
  - Translate `response.data` + `payload` + migration schema into:
    - a **set of concrete queries** (SQL / NoSQL / ORM pipelines),
    - or a single composed query, depending on the use case.
  - Ensure the generated queries:
    - only access allowed entities and fields,
    - apply filters derived from `payload` (e.g. `user_id`, `company_id`, `competency_id`).

- **Execution & mapping**:
  - Execute the generated queries against the underlying data sources.
  - Map raw results back into the **exact shape of `response.data`**.
  - Return a filled `data` object to the handler, which is then wrapped inside the unified response:

    ```json
    {
      "requester_service": "<same as input>",
      "payload": { ...same as input... },
      "response": {
        "status": "success | error",
        "message": "string",
        "data": { ...populated according to `response.data` template... }
      }
    }
    ```

---

### 2. High-Level Flow

1. **Unified Endpoint receives request**:
   - Body includes `requester_service`, `payload`, and `response.data` (template of requested fields).

2. **Handler invokes AI Query Builder**:
   - The handler for the specific `requester_service` prepares:
     - `payload` (inputs),
     - `responseTemplate.data` (requested output shape),
     - the **migration file** (or a filtered / relevant subset of it).

3. **Backend constructs prompt for Gemini**:
   - The backend builds a structured prompt that:
     - describes the role: “You are a query builder for the Skills Engine data model.”
     - includes:
       - the migration schema (or relevant parts),
       - the raw `payload`,
       - the desired `response.data` shape.
     - asks Gemini to:
       - propose one or more **concrete queries** that can be executed safely,
       - clearly label the output as executable query text.

4. **Gemini returns generated query text**:
   - The backend receives the generated query/queries as plain text (SQL, ORM call descriptions, etc.).

5. **Backend validates and executes the query**:
   - Optionally performs:
     - static checks (allowed tables/collections, forbidden operations),
     - logging and audit.
   - Executes the query via existing database / repository layers.

6. **Backend maps results into `response.data`**:
   - Uses the original `response.data` template as a **projection**:
     - walks the template structure,
     - fills in each requested field using the query results.
   - Returns the completed `data` object to the handler.

7. **Handler sends unified response**:
   - Wraps the filled `data` into the standard unified response envelope and returns it to the caller.

---

### 3. Prompt Structure (Conceptual)

The exact prompt implementation will live in code, but conceptually it contains these sections:

- **System / role instructions**:
  - Explain that the model:
    - must act as a **deterministic query planner and generator**,
    - must use only the provided schema from the migration file,
    - must not invent tables/fields.

- **Schema context (from migration file)**:
  - A text or structured summary of:
    - entities (users, competencies, skills, exams, etc.),
    - relationships (user–competency, competency–skills, etc.),
    - field names and types.

- **Request context**:
  - Serialized `payload` (as JSON).
  - Serialized `response.data` template (as JSON).

- **Task instruction**:
  - Example wording:
    - “Given the schema, the input payload, and the desired response.data shape, generate the minimal set of database queries needed to fill all requested fields. Use only allowed entities and relationships. Do not return any explanation, only the query/queries in a machine-readable format.”

- **Output format**:
  - Define a strict JSON shape for Gemini’s reply, e.g.:

    ```json
    {
      "queries": [
        {
          "name": "string",
          "language": "sql | orm | nosql",
          "text": "SELECT ...",
          "target": "which part of response.data this query is for"
        }
      ]
    }
    ```

  - This makes it easier for the backend to parse and execute the queries safely.

---

### 4. Integration Points

- **Services / handlers**:
  - Each handler that needs dynamic query building (e.g. analytics, learner AI) calls the AI Query Builder service with:
    - `payload`,
    - `responseTemplate.data`,
    - relevant migration schema.

- **AI client wrapper**:
  - A dedicated module (e.g. `aiQueryBuilderClient`) is responsible for:
    - constructing the full prompt,
    - calling the Gemini API,
    - parsing the returned queries,
    - exposing a clean function like:

      ```js
      async function buildQueries({ payload, responseTemplateData, schema }) { /* ... */ }
      ```

- **Execution layer**:
  - Uses existing repositories / ORM / DB clients to execute the generated queries and return results in a normalized internal format.

---

### 5. Safety & Constraints (outline)

- Only allow queries that:
  - reference known entities and fields from the migration schema,
  - avoid destructive operations (no INSERT/UPDATE/DELETE from the AI),
  - respect tenant boundaries (e.g. `company_id` scoping).

- All AI-generated queries should be:
  - logged (for debugging and audits),
  - optionally run first in a read-only mode / transaction.

Detailed safety policies and validation rules will be defined in a separate implementation document or within the AI client module.

---

### 6. Field Name Mapping Between Microservices and Skills Engine

External microservices are free to use their **own field names** in `response.data`. The AI Query Builder is responsible for bridging those names to Skills Engine’s **internal schema**:

- The prompt includes:
  - the external `response.data` shape (field names as seen by the caller),
  - the internal schema from the migration file (tables, columns, relationships),
  - optional mapping hints (e.g. "`userScore` corresponds to `relevance_score` on users").
- The AI uses this context to:
  - generate queries over **internal** field names and relationships,
  - and then map the results back into the **external** structure of `response.data` when building the filled `data` object.

This allows each microservice to keep its own naming conventions while Skills Engine maintains its own internal model, with the Query Builder acting as a smart translation layer between the two.