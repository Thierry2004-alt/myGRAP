# GRAP — PROJECT CONTEXT

## 2. Project Identity

**Project name:** GRAP

**Theme:** CONCEPTION AND REALIZATION OF RIDE-HAILING PLATFORM WITH DYNAMIC RIDE-SHARING FOR OPTIMIZED URBAN MOBILITY.

GRAP is a mobile ride-hailing platform designed for urban mobility. It provides conventional ride-hailing services while introducing voluntary, route-based dynamic ride-sharing and driver-oriented analytics/recommendations.

GRAP is not intended to reproduce Yango exactly. Existing ride-hailing concepts such as service categories, driver tracking, payments, ratings, and ride management are the baseline. GRAP differentiates itself through voluntary dynamic ride-sharing, route compatibility, shared-fare allocation, place discovery, loyalty mechanisms, and driver demand analytics/recommendations.

## 3. Technology Stack

### Frontend
- React Native
- Expo
- TypeScript
- VS Code
- Android/iOS as primary targets
- Expo Go for early development/testing
- EAS Build later for APK/AAB

### Backend
- Django
- Django REST Framework (DRF)
- Python
- REST API architecture

### Database
- SQLite for development, testing, and the current academic defense prototype.
- Use Django ORM so migration to PostgreSQL/PostGIS later remains possible.

### Services included for now
- Firebase Cloud Messaging (FCM) for push notifications
- SMTP for email

### Services planned later
- Maps/geolocation API
- Payment/Mobile Money API
- More advanced AI/ML services
- PostgreSQL/PostGIS
- Production hosting/deployment

Do not make future services mandatory in the first implementation phase unless explicitly requested.


## 2A. Application Architecture — Single App with RBAC

GRAP uses **ONE React Native mobile application** for all user-facing roles rather than separate passenger and driver applications.

Role-based access control (RBAC) determines which interface, screens, actions and API permissions are available after authentication.

### Role flow

User opens GRAP
-> Authentication
-> Django identifies authenticated user and role
-> Role-based navigation/interface
-> Role-specific features

Primary roles:
- Passenger
- Driver
- Admin

The same mobile application can therefore expose different dashboards and navigation depending on the authenticated role.

### Passenger interface
Typical sections:
- Home
- Request Ride
- Share Ride
- Ride Tracking
- Ride History
- Payments
- Places
- Notifications
- Profile/Settings
- Safety

### Driver interface
Typical sections:
- Driver Dashboard
- Ride Requests
- Active Ride
- Shared Ride
- Earnings
- Withdrawals
- Vehicle
- Ride History
- Performance
- Demand Analytics
- AI Recommendations
- Notifications
- Profile/Settings

### Admin interface
The admin role may use an administrative interface within the same application, although a separate web administration interface may be introduced later if needed.

Typical sections:
- Dashboard
- Users
- Drivers
- Vehicles
- Rides
- Payments/Commissions
- Reports
- Analytics
- Settings

### Security rule

Frontend RBAC controls what the user sees and improves the user experience, but it is **not the authoritative security mechanism**.

Django must enforce role-based authorization on every protected API endpoint.

A user must never gain permissions merely by modifying the mobile application's frontend state or request payload.

Architecture:

React Native single app
-> JWT authentication
-> Django REST API
-> Authentication + Role/Permission checks
-> Business logic
-> Database

The backend is the source of truth for identity, roles and permissions.

### Future role flexibility

The RBAC design should allow additional roles or permission profiles later without requiring separate mobile applications. For example, vehicle-owner capabilities can be introduced as a dedicated role or as permissions associated with an existing account model.

## 4. Actors

### Passenger
- Create/authenticate account
- Manage profile
- Request normal rides
- Choose ride category
- Track driver/ride
- Voluntarily request shared rides
- Join compatible shared rides
- Make own ride shareable when no match exists
- Pay after ride completion
- Rate drivers
- View ride history
- Discover places
- Receive notifications
- Manage safety/settings
- Earn/use loyalty points

### Driver
- Register/authenticate
- Submit identity/driving documents
- Wait for verification/approval
- Manage online/offline availability
- Manage or operate an assigned vehicle
- Receive, accept/reject rides
- Navigate to passengers
- Conduct normal and shared rides
- Complete rides
- Confirm cash payments
- View earnings
- Withdraw earnings
- View history, ratings and performance
- Receive demand insights and personalized recommendations

### Admin
- Manage users
- Manage/suspend drivers
- Verify drivers/documents
- Manage vehicles
- Verify vehicles
- Monitor rides/shared rides
- Manage payments and commissions
- Manage reports
- View analytics
- Manage platform settings

### External services
- Firebase FCM: push notifications
- SMTP: email delivery
- Maps/geolocation API: later
- Payment/Mobile Money API: later

## 5. Core Modules

### Authentication & User Management
- Registration
- Login
- OTP verification
- JWT authentication
- Roles: Passenger, Driver, Admin
- Profile management
- Account status
- Suspension/deactivation
- Password reset
- Token/session invalidation after suspension

Protected operations require authentication.

### Passenger Management
Profile, saved/frequent places, ride requests, normal rides, shared rides, payments, ratings, history, notifications, safety, places and loyalty.

### Driver Management
Registration, verification, documents, admin approval, availability, ride requests, pickup, active rides, shared passengers, completion, ratings, earnings, withdrawals and analytics/recommendations.

### Vehicle Management
Vehicle management is separate from driver management.

Important rule: a driver does not necessarily own the vehicle.
- A vehicle owner can register one or more vehicles.
- A driver can be assigned to operate a vehicle.
- Owner and driver can be different people.
- Ownership and driver assignment must be tracked separately.

### Ride Management
Support normal ride-hailing with categories such as:
- Economy
- Comfort
- Comfort+
- Moto
- Other categories later

Normal flow:
1. Select pickup.
2. Select destination.
3. Obtain route/distance.
4. Estimate fare.
5. Choose category.
6. Request ride.
7. Match driver.
8. Track ride.
9. Complete ride.
10. Pay.
11. Rate driver.

## 6. Voluntary Dynamic Ride-Sharing — Critical Rule

**Ride-sharing is strictly voluntary.**

A passenger requesting a private/normal ride must never be automatically placed into a shared ride merely because another passenger has a similar route.

### Shared-ride workflow
1. Passenger explicitly selects **Share Ride**.
2. System obtains pickup and destination.
3. System calculates/obtains route.
4. System searches for existing rides that:
   - were voluntarily made shareable,
   - have available capacity,
   - have compatible routes/pickups,
   - satisfy maximum detour/timing rules.
5. If compatible rides exist:
   - Display available shared rides/cars.
   - Passenger chooses one.
   - Validate current availability/capacity.
   - Calculate/display passenger shared fare.
   - Passenger confirms joining.
   - Add passenger to shared ride.
6. If no compatible ride exists:
   - Tell passenger no compatible shared ride is currently available.
   - Offer **Make My Ride Shareable**.
   - If selected, make the ride available for future compatible passengers.
7. A later passenger may join if route/capacity conditions are satisfied.

Do not show a confusing “shared mode activated” state before searching for a match.

## 7. Shared-Ride Matching

Compatibility can use:
- Route overlap
- Pickup proximity
- Destination direction
- Maximum acceptable detour
- Available seats
- Ride status
- Timing/estimated pickup compatibility
- Sharing preferences

The initial search establishes route compatibility. After a passenger selects a result, validate current availability/capacity again because another passenger may have taken a seat. Do not perform an unnecessary second route-compatibility calculation unless the route changed.

## 8. Shared-Fare Algorithm

Use the agreed proportional algorithm.

First calculate the normal/solo fare for each passenger's route using the platform fare rules. Then allocate the shared ride's total fare according to each passenger's solo-route proportion.

Example:
- A solo route: 10 km
- B solo route: 6 km
- Shared total: 2,000 FCFA
- Total weight: 16 km

A = 2000 × 10/16 = **1,250 FCFA**
B = 2000 × 6/16 = **750 FCFA**

If the combined route introduces a pickup/drop-off detour, the actual shared route should be considered in the total fare according to the platform pricing rules.

Keep fare calculation modular and server-side.

## 9. Location and Route Management

A maps/geolocation service is planned for:
- Current position
- Pickup/destination coordinates
- Geocoding/search
- Route calculation
- Distance
- Estimated travel time
- Route compatibility
- Place discovery

Conceptual dependencies:
- Location -> Fare
- Location -> Ride
- Location -> Shared Ride

## 10. Driver Earnings and Withdrawals

For each completed ride:
1. Record final fare.
2. Calculate configurable platform commission.
3. Record driver's eligible earnings.
4. Update available balance.
5. Driver requests withdrawal when eligible.
6. Record withdrawal/status.
7. Future payment integration processes payout.
8. Notify driver.

Do not hard-code a real competitor's commission; make the rate configurable.

### Cash payment
The system cannot automatically know that physical cash was handed over.

Recommended flow:
1. Record final fare.
2. Passenger gives cash to driver.
3. Driver marks cash received.
4. Passenger confirms using a one-time PIN/OTP or equivalent.
5. Record transaction.
6. Flag failed/mismatched confirmation for review.

For shared rides, track each passenger's payment separately.

## 11. Driver AI / Analytics — Major GRAP Innovation

This module must remain a major part of GRAP.

The objective is to help drivers decide **where and when to operate** using historical GRAP data.

### Data analyzed
- Historical ride requests
- Pickup zones
- Destination zones
- Frequently traveled routes
- Request times
- Day of week
- Driver's own historical activity
- Completed rides
- Earnings
- Ride frequency
- Shared-ride activity
- Demand concentration by area/time

### Personalized recommendations
GRAP can recommend:
- High-demand locations
- High-demand time periods
- Frequently requested destinations
- Frequently traveled routes
- Where the driver should position themselves
- Better earning opportunities
- Patterns based on the driver's own daily/weekly routine

Examples:
> Based on your activity during the last 14 days, demand around Mvan → Bastos is usually high between 17:00 and 19:00.

> You frequently complete rides toward Bastos around 18:00. Consider positioning yourself near Mvan before 17:30.

> High demand is predicted around Mokolo between 07:00 and 09:00 tomorrow.

The system must not claim certainty about the future. For the defense prototype, historical analytics plus rule-based recommendations are acceptable. The architecture should later support machine-learning demand prediction.

Potential future AI/ML:
- Demand prediction
- Demand heatmaps
- Time-series forecasting
- Route-demand prediction
- Personalized driver recommendations

## 12. Driver Performance Analytics

Driver dashboard can show:
- Completed rides
- Accepted rides
- Acceptance rate
- Cancellation rate
- Average rating
- Earnings
- Earnings evolution
- Most active periods
- Most frequent destinations
- Most profitable routes/periods
- Shared-ride participation
- Demand recommendations

Distinction:
- Performance analytics describes what happened.
- AI/demand recommendations help decide what to do next.

## 13. Firebase Notifications

Firebase is currently used for push notifications.

Flow:
Passenger -> Django -> Firebase FCM -> Driver phone

Possible notifications:
- New ride request
- Ride accepted
- Driver arriving
- Ride cancelled
- Shared passenger request
- Shared ride confirmed
- Payment confirmed
- Withdrawal status
- Driver verification result
- Demand recommendation

Store device tokens in Django. Firebase service-account credentials must stay on the backend and never be included in the React Native app or GitHub.

## 14. SMTP / Email

Django may use SMTP for:
- Registration confirmation
- Email/OTP verification if selected
- Password reset
- Driver verification notifications
- Payment receipts
- Withdrawal confirmation
- Security/account notifications

SMTP credentials must be stored in environment variables and never exposed in the mobile application or repository.

## 15. Payments

Payment is a separate business function.

**Make Payment is NOT an extension of Request Ride.**

Correct conceptual flow:
Request Ride -> Ride Completed -> Make Payment -> Transaction Recorded

Current prototype:
- Cash

Later:
- Mobile Money/payment API

## 16. Ride Lifecycle

Suggested states:

REQUESTED
-> MATCHING
-> ACCEPTED
-> DRIVER_ARRIVING
-> DRIVER_AT_PICKUP
-> IN_PROGRESS
-> COMPLETED

Exceptional states:
- CANCELLED_BY_PASSENGER
- CANCELLED_BY_DRIVER
- EXPIRED
- PAYMENT_PENDING
- PAYMENT_CONFIRMED

Shared rides may additionally track:
- SHAREABLE
- PASSENGER_JOINED
- AVAILABLE_SEATS
- MULTI_PASSENGER_IN_PROGRESS

Exact enum names may change, but lifecycle consistency is required.

## 17. Ratings and History

After completion, the passenger can rate the driver. Ratings contribute to driver performance.

History should contain:
- Date/time
- Pickup
- Destination
- Category
- Fare
- Driver/vehicle information
- Payment status
- Private/shared status
- Rating status

Driver history should include completed rides, earnings, routes and shared-ride information subject to privacy rules.

## 18. Place Discovery and Loyalty

GRAP may allow discovery of:
- Restaurants
- Shopping areas
- Entertainment
- Tourist/cultural locations
- Other points of interest

Loyalty points may be earned from eligible activities such as completed rides, frequent usage, shared rides and promotions. Future uses can include discounts/rewards. Keep rules configurable.

## 19. Safety

Possible features:
- SOS/emergency action
- Ride tracking
- Driver identification
- Vehicle information
- Reporting mechanisms

Do not over-engineer safety features unless required for the defense.

## 20. Security

- Django securely hashes passwords.
- JWT authentication.
- OTP where appropriate.
- Role-based authorization.
- Suspended users cannot authenticate/use protected services.
- Payment credentials stay secure.
- Firebase service-account credentials stay on backend.
- SMTP credentials stay on backend/environment variables.
- Validate all API input.
- Fare calculation is server-side.
- Earnings/payment records are server-side.
- Audit sensitive actions.
- Never trust fare, payment, earnings or role information supplied by the mobile client.

## 21. Main Domain Entities

Initial conceptual entities:
- User
- Passenger/Profile
- Driver
- Vehicle
- VehicleOwner
- DriverVehicleAssignment
- Ride
- RideCategory
- SharedRide
- SharedRideParticipant
- Location
- Route
- Fare
- Payment
- Earnings
- Withdrawal
- Rating
- Notification
- DeviceToken
- LoyaltyPoint/Transaction
- Place
- DriverAnalytics
- DemandObservation
- Recommendation
- Report

These may be consolidated or separated during implementation.

## 22. Backend Organization

Start simple:

backend/
- config/
- core/
- manage.py
- db.sqlite3

As the project grows, `core` can be split into:
- accounts/
- drivers/
- vehicles/
- rides/
- shared_rides/
- payments/
- notifications/
- ratings/
- analytics/
- places/

Do not create excessive Django apps prematurely.

## 23. Frontend Organization

Suggested:

frontend/
└── GRAP/
    ├── app/ or src/
    ├── components/
    ├── screens/
    ├── navigation/
    ├── services/
    │   └── api.ts
    ├── hooks/
    ├── types/
    ├── utils/
    ├── constants/
    └── assets/

Use REST APIs to communicate with Django.

## 24. API Architecture

Correct architecture:

React Native
-> Django REST API
-> Django ORM
-> SQLite

Later:

React Native
-> Django REST API
-> Django ORM
-> PostgreSQL/PostGIS

The mobile application must never directly access SQLite.

## 25. Current Implementation Scope

### Implement now
1. React Native + Expo + TypeScript foundation
2. Django + DRF foundation
3. SQLite
4. Authentication and roles
5. Passenger module
6. Driver module
7. Vehicle module
8. Normal ride-hailing
9. Ride categories
10. Voluntary dynamic ride-sharing
11. Shared-ride matching
12. Shared-fare calculation
13. Driver earnings
14. Basic withdrawal records
15. Ratings
16. Ride history
17. Firebase push notifications
18. SMTP email
19. Driver analytics/recommendation prototype

### Later
- Maps/geolocation API
- Mobile Money/payment API
- Advanced ML
- PostgreSQL/PostGIS
- Production deployment
- Advanced place discovery
- Advanced safety integrations

## 26. Important Decisions — Do Not Break These Without Explicit Approval

1. GRAP is a ride-hailing platform, not only a ride-sharing app.\n2. GRAP uses ONE mobile application with Role-Based Access Control (RBAC), not separate passenger and driver applications.
2. Shared rides are optional and explicitly initiated.
3. A private passenger is never automatically added to sharing.
4. Passenger selects Share Ride first; GRAP searches existing compatible shareable rides.
5. If no match exists, passenger can make their own ride shareable.
6. Shared fares use the agreed proportional solo-route algorithm.
7. Payment happens after ride completion and is separate from ride request in UML.
8. Cash payment uses driver confirmation plus passenger confirmation/OTP-style validation.
9. Vehicle ownership is separate from driver operation.
10. Driver analytics/recommendations are a major GRAP innovation.
11. Recommendations use historical demand and the driver's personal routine/activity patterns.
12. The initial AI can be rule-based/historical; architecture should support future ML.
13. SQLite is the current defense database.
14. Firebase is included now for push notifications.
15. SMTP is included now for email.
16. Maps and payment APIs come later.
17. Frontend is React Native + Expo + TypeScript.
18. Backend is Django + DRF.
19. Mobile communicates through APIs and never directly with SQLite.
## 27. UML Guidance

### Primary actors
- Passenger
- Driver
- Admin

### External actors
- Firebase FCM
- SMTP
- Maps/Geolocation API (later)
- Payment API (later)

### Passenger use cases
- Create Account
- Authenticate
- Update Profile
- Request Ride
- Choose Ride Category
- Track Ride
- Share Ride
- Join Shared Ride
- Make Ride Shareable
- Make Payment
- Rate Driver
- View Ride History
- Discover Places
- Manage Notifications
- Manage Safety

### Driver use cases
- Authenticate
- Manage Profile
- Submit Documents
- Manage Vehicle/Assignment
- Set Availability
- Manage Ride
- Accept/Reject Ride
- Complete Ride
- Manage Shared Ride
- Confirm Cash Payment
- View Earnings
- Withdraw Earnings
- View Ride History
- View Performance
- View Demand Analytics
- Receive Recommendations

### Admin use cases
- Manage Users
- Suspend User
- Manage Drivers
- Verify Driver
- Manage Vehicles
- Verify Vehicles
- Monitor Rides
- Manage Payments/Commissions
- Manage Reports
- View Analytics

### Package dependencies
- User/Auth -> Passenger/Driver/Admin
- Ride -> Location, Fare, Notification
- Shared Ride -> Ride, Location, Fare
- Driver -> Ride, Vehicle, Earnings, Analytics
- Rating -> Ride
- History -> Ride
- Payment -> Ride Completion and Payment API later
- Notification -> Firebase FCM
- Email -> SMTP
- Analytics -> Ride History, Driver Activity, Demand Data

## 28. Shared-Ride Sequence — Agreed Logic

Main:
1. Passenger -> GRAP: selectShareRide()
2. GRAP -> Location service: getRoute(pickup, destination)
3. Location service -> GRAP: returnRoute(route, distance)
4. GRAP -> Database: findCompatibleShareableRides(route, pickup)
5. Database -> GRAP: returnCompatibleRides()
6. GRAP -> Passenger: displayAvailableSharedRides()
7. Passenger -> GRAP: selectRide(rideId)
8. GRAP -> Database: validateRideAvailability(rideId)
9. Database -> GRAP: returnRideStatus(status)
10. GRAP -> Passenger: displaySharedFare(fare)
11. Passenger -> GRAP: confirmJoinRide(rideId)
12. GRAP -> Database: addPassengerToSharedRide()
13. Database -> GRAP: sharedRideUpdated()
14. GRAP -> Passenger: displaySharedRideConfirmation()

Alternative: no compatible ride:
6a. GRAP -> Passenger: displayNoSharedRideAvailable()
7a. Passenger -> GRAP: selectMakeRideShareable()
8a. GRAP -> Database: activateRideSharing(rideId)
9a. Database -> GRAP: rideSharingActivated()
10a. GRAP -> Passenger: displayRideShareableConfirmation()

Do not perform a redundant second route compatibility search after selection; validate availability/capacity unless the route changed.

## 29. Use-Case Description Template

Use:
- Title
- Summary
- Actor
- Version
- Precondition
- Trigger
- Nominal Scenario
- Alternative Scenario
- Exceptional Scenario
- Post-condition of Success
- Post-condition of Failure

Keep scenarios simple and numbered.

## 30. Development Rules for Coding Agents

Before changing code:
1. Read this file first.
2. Respect established business rules.
3. Do not silently change major decisions.
4. If a requested change conflicts with this context, identify the conflict before implementing.
5. Keep business logic on Django.
6. Keep React Native focused on UI, local state, navigation and API interaction.
7. Keep fare calculation server-side.
8. Keep authentication/authorization server-side.
9. Keep earnings/payment records server-side.
10. Keep Firebase and SMTP secrets off the client.
11. Use Django ORM rather than SQLite-specific application logic.
12. Keep modules separated enough for future integrations.
13. Avoid unnecessary dependencies.
14. Implement incrementally and test each module.
15. Do not introduce PostgreSQL, Maps API or payment APIs until explicitly requested.

## 31. Evolution Roadmap

Phase 1: project setup, authentication, roles, SQLite, base UI/navigation.

Phase 2: passenger, driver, vehicle and verification.

Phase 3: normal ride-hailing, categories, lifecycle and basic fare.

Phase 4: voluntary dynamic ride-sharing, matching, route management and shared fare.

Phase 5: payments, earnings and withdrawals.

Phase 6: Firebase notifications and SMTP emails.

Phase 7: driver analytics, historical demand analysis and personalized recommendations.

Phase 8: Maps/geolocation, Mobile Money/payment provider and advanced AI/ML.

Phase 9: production database/deployment, optimization and security hardening.

## 32. Final Product Vision

### Passenger experience
GRAP provides convenient ride-hailing where passengers can choose either a normal/private ride or voluntarily participate in dynamic route-compatible ride-sharing to reduce cost.

### Driver experience
GRAP is both a ride-management/earning platform and a decision-support tool. It helps drivers understand demand through historical analytics, personal routine analysis, high-demand location/time recommendations and earnings/performance insights.

### Defining idea
**GRAP does not only connect passengers with drivers; it also uses ride data to optimize voluntary ride-sharing and help drivers understand where and when demand is likely to be strongest.**
