# **Queue Management System (QMS) – Technical Product Requirements Document**

## **1. Overview**

The Queue Management System (QMS) is a multi-tenant, event-driven platform for managing patient or client flow across multiple service queues.
It supports **appointments, walk-ins, queue transfers, real-time updates,** and **integration with EMR systems**.

QMS can operate standalone or be integrated as a **service layer** in a healthcare ecosystem, allowing other systems (e.g., EMR, LIS, pharmacy systems) to register patients, monitor queue positions, and trigger queue transitions automatically.

---

## **2. Core Objectives**

* Streamline service queues across multiple locations and service types.
* Support **both scheduled and walk-in** users.
* Provide real-time updates and queue control interfaces for staff and patients.
* Enable **seamless flow across service stages** (e.g., Reception → Doctor → Lab → Pharmacy).
* Offer APIs for **integration with EMR and third-party systems.**
* Deliver analytics for throughput, service utilization, and wait times.

---

## **3. User Roles & Stories**

| Role                           | Description                                    | Core Capabilities                               |
| ------------------------------ | ---------------------------------------------- | ----------------------------------------------- |
| **Super Admin**                | Manages system-wide settings and organizations | Create orgs, locations, users, view reports     |
| **Org Admin / Location Admin** | Manages services and queues for their location | Configure services, assign staff, manage queues |
| **Service Staff**              | Operates within a queue                        | Call next, mark served, move to next queue      |
| **Front Desk / Reception**     | Books appointments, checks in walk-ins         | Create/reschedule bookings, issue queue tickets |
| **Patient / User**             | End user of service                            | Book/view queue, scan QR, receive updates       |

### **User Stories**

* As a **patient**, I can scan a QR code at a kiosk to join a queue.
* As a **receptionist**, I can book a patient into a future slot or move them across queues.
* As a **doctor**, I can see my active queue and call the next patient.
* As an **admin**, I can configure service schedules and define flow relationships.
* As a **system**, I can notify users when their turn is approaching.
* As an **analyst**, I can generate a report on average wait time per service.

---

## **4. Entity & Data Model**

### **4.1 Key Entities**

| Entity           | Description                                    | Key Fields                                                                                     |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Organization** | Logical tenant grouping locations and services | id, name, contact_info                                                                         |
| **Location**     | Physical or virtual branch                     | id, org_id, name, timezone                                                                     |
| **Service**      | Defines a queue type or medical service        | id, location_id, name, type (individual/general), slot_duration, concurrent_limit, active_days |
| **Practitioner** | Optional linkage to a service                  | id, user_id, service_id                                                                        |
| **Queue**        | Real-time representation of people waiting     | id, service_id, date, status (active, closed)                                                  |
| **Slot**         | A time-based division for booking              | id, queue_id, start_time, end_time, capacity                                                   |
| **QueueEntry**   | Represents a person in a queue                 | id, queue_id, user_id, status (waiting, serving, served, cancelled), ticket_number, priority   |
| **ServiceFlow**  | Defines order of services                      | id, from_service_id, to_service_id, condition                                                  |
| **Appointment**  | Links user and queue slot                      | id, user_id, service_id, slot_id, created_by, rescheduled_at                                   |
| **User**         | Patient or staff                               | id, org_id, role, name, contact_info                                                           |
| **Notification** | Queue-related message                          | id, user_id, message_type, sent_at, channel                                                    |

---

### **4.2 Entity Relationships**

**Organization → Location → Service → Queue → Slot → QueueEntry**

* One Organization has many Locations.
* One Location has many Services.
* One Service spawns multiple Queues (daily instances).
* Each Queue has Slots (time windows).
* Slots contain multiple QueueEntries (patients).
* QueueEntries can move across Services via ServiceFlow.

---

## **5. API & Event Specifications**

### **5.1 Core REST APIs**

| Function              | Endpoint                                     | Method | Description                            |
| --------------------- | -------------------------------------------- | ------ | -------------------------------------- |
| Create Organization   | `/api/v1/orgs`                               | POST   | Create new organization                |
| Create Location       | `/api/v1/orgs/{org_id}/locations`            | POST   | Add location                           |
| Create Service        | `/api/v1/locations/{id}/services`            | POST   | Define a service                       |
| Get Service Schedule  | `/api/v1/services/{id}/schedule`             | GET    | Retrieve configured schedule           |
| Create Queue          | `/api/v1/queues`                             | POST   | Instantiate a queue for a date         |
| Join Queue            | `/api/v1/queues/{id}/join`                   | POST   | Add user to queue (manual or via QR)   |
| Move Queue Entry      | `/api/v1/queues/{id}/move`                   | PATCH  | Move entry across queues               |
| Get Queue Status      | `/api/v1/queues/{id}`                        | GET    | List current entries and states        |
| Mark Served           | `/api/v1/queues/{id}/entry/{entry_id}/serve` | PATCH  | Mark patient as served                 |
| Create Appointment    | `/api/v1/appointments`                       | POST   | Create appointment for future queue    |
| Get Wait Time         | `/api/v1/queues/{id}/waittime`               | GET    | Returns average or real-time wait time |
| Generate Ticket       | `/api/v1/queues/{id}/ticket/{entry_id}`      | GET    | Returns printable ticket with QR       |
| Notifications Webhook | `/api/v1/notifications/send`                 | POST   | Send push/SMS/email update             |

---

### **5.2 WebSocket Events (Real-time Updates)**

* `queue.updated`: Queue state or order changed.
* `entry.status_changed`: Waiting → Serving → Served.
* `slot.released`: Slot freed after cancellation.
* `serviceflow.transition`: User moved to next queue.
* `notification.sent`: User notified.

---

### **5.3 Integration APIs (EMR)**

| Integration                   | Direction     | Description                                        |
| ----------------------------- | ------------- | -------------------------------------------------- |
| **Create Queue Entry**        | Inbound       | EMR sends service request to QMS                   |
| **Service Completion Update** | Outbound      | QMS notifies EMR when queue service ends           |
| **Patient Data Sync**         | Bidirectional | Securely sync user identifiers, name, demographics |
| **Service Flow Trigger**      | Outbound      | QMS triggers EMR when patient moves to next step   |

---

## **6. System Architecture**

### **6.1 Logical Components**

1. **API Gateway** – Authentication, routing, and rate limiting.
2. **Queue Engine Service** – Core logic for queue management, slotting, transitions.
3. **Scheduling Service** – Manages recurring service configurations and slot generation.
4. **Notification Service** – Push, SMS, and email integration.
5. **Reporting Service** – Aggregates metrics, provides analytics API.
6. **Integration Gateway** – Handles EMR and external API/webhook calls.
7. **Frontend Apps:**
   * **Admin Dashboard**
   * **Queue Display Interface**
   * **Mobile / Kiosk Interface**

---

### **6.2 Event Flow Example**

1. **Patient checks in (via kiosk or EMR integration).**
2. QMS assigns to **Service A's** next available slot.
3. QueueEntry created → triggers `queue.updated`.
4. When called by staff → status changes to "Serving".
5. On completion → QMS triggers `serviceflow.transition` to **Service B (e.g., Lab)**.
6. Notifications sent automatically to patient.
7. Reports update queue time metrics asynchronously.

---

## **7. Non-Functional Requirements**

| Category         | Description                                                                    |
| ---------------- | ------------------------------------------------------------------------------ |
| **Performance**  | <2s latency on queue state updates                                             |
| **Scalability**  | Horizontal scale for queue and notification microservices                      |
| **Reliability**  | Auto-recovery and message replay for missed queue events                       |
| **Security**     | JWT/OAuth2 for API; role-based access control; encryption in transit & at rest |
| **Compliance**   | HIPAA/GDPR where integrated with EMR                                           |
| **Auditability** | All queue movements, reschedules, and transitions logged                       |
| **Availability** | 99.5% uptime target                                                            |

---

## **8. Reporting & Analytics**

* **Per Service Metrics:**
  * Average wait time
  * Average service time
  * No-shows vs served ratio
* **Per Location Metrics:**
  * Daily throughput
  * Bottleneck identification
* **Flow Analytics:**
  * Avg. duration between services (Reception → Doctor → Lab → Pharmacy)

Integration-ready with BI tools (e.g., Power BI, AWS Redshift).

---

## **9. Phase Recommendations**

| Phase       | Focus                                               | Deliverables                                                |
| ----------- | --------------------------------------------------- | ----------------------------------------------------------- |
| **Phase 1** | Core queue engine, admin dashboard, scheduling, API | Queue + Service CRUD, real-time queue ops, role-based admin |
| **Phase 2** | Integration & mobility                              | EMR API, mobile queue tracker, QR tickets                   |
| **Phase 3** | Analytics & AI                                      | Predictive wait times, heatmaps, Power BI integration       |
| **Phase 4** | Advanced automation                                 | Self-service flows, auto-routing, offline sync              |

---

## **10. Technical Stack**

### **Backend**
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Cache:** Redis
- **Real-time:** Socket.IO
- **Authentication:** JWT

### **Frontend**
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **HTTP Client:** Axios
- **Real-time:** Socket.IO Client

### **Infrastructure**
- **Containerization:** Docker & Docker Compose
- **Database:** PostgreSQL 15
- **Cache:** Redis 7

---

## **11. Security Considerations**

1. **Authentication:** JWT-based authentication with refresh tokens
2. **Authorization:** Role-based access control (RBAC)
3. **Data Encryption:** TLS for data in transit, encryption at rest for sensitive data
4. **API Security:** Rate limiting, input validation, CORS configuration
5. **Audit Logging:** All critical operations logged with user context
6. **HIPAA Compliance:** PHI data handling, access controls, audit trails

---

## **12. Development & Deployment**

### **Development Workflow**
1. Local development with Docker Compose
2. Feature branches with PR reviews
3. Automated testing (unit, integration, e2e)
4. CI/CD pipeline with GitHub Actions

### **Deployment Options**
1. **Docker Compose:** Quick deployment for small installations
2. **Kubernetes:** Scalable production deployment
3. **Cloud Platforms:** AWS, Azure, or GCP with managed services

---

## **13. Future Enhancements**

- **AI-powered wait time predictions**
- **Mobile app for patients**
- **Kiosk mode for self-service check-in**
- **Multi-language support**
- **Offline mode with sync**
- **Video calling integration**
- **Payment processing integration**
- **Advanced reporting dashboards**

---

**Document Version:** 1.0  
**Last Updated:** November 2, 2025  
**Status:** Implementation Ready
