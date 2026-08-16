<!-- BEGIN SCOREBIRD SHARED CONTEXT -->

# Scorebird

Scorebird is a management platform for sports organizations to configure,
customize and integrate live-scoring functionality around the **NeST** — a small
hardware (or virtual) device that reads a scoreboard and broadcasts the score to
widgets, overlays and livestreams.

The platform's audience is school coaches, athletic directors, broadcasters and
sports association managers. The web app is the richer of the two surfaces; the
**Admin App** mirrors a subset of the same flows, and **ScoreBuddy** is a
separate companion app for coaches who want to drive a Virtual NeST from a
phone.

## Language

### Core Concepts

#### Organization

The top-level unit a user works inside. Owns **Facilities**, **Teams**,
**Schedules** and **Devices**, and has **Users** assigned to it. Almost
everything in the product is scoped by Organization.

Each Organization has a mandatory **Organization Type**:

- Sports Organization
- Educational Institution
- Media & Broadcast
- Business & Community

If the Type is `Educational Institution`, a **Sub-Type** is also required:
`K-12 School`, `College & University`, `Sports Academy`, or `Other`.

**Avoid:** treating "School" and "Organization" as synonyms. A **School** is
specifically an Organization with Type `Educational Institution` + Sub-Type
`K-12 School`. Saying "school" when the user means "any organization" is the
single biggest source of confusion in this product — always clarify intent.

#### School

A specific kind of Organization: Type `Educational Institution`, Sub-Type
`K-12 School`. Schools are currently the only Organization shape that triggers
Super Admin pre-approval when created by a regular user, but the approval gate
is subtype-driven, not hardcoded. Any subtype whose `requires_approval` flag is
true follows the same flow. Today only `K-12 School` carries that flag.

An Organization that requires approval carries a `join_state` of `awaiting`,
`approved`, or `denied`. While `join_state === "awaiting"` the Organization is
locked for editing by non-Super-Admins, and the manage-organization form
surfaces a **Pending approval** alert.

#### Facility

A physical venue belonging to an Organization. Schedules happen at a Facility,
and a **NeST** is assigned to a Facility. A Facility can have **Teams** assigned
to it as well.

#### Team

A roster identified by School/Organization, Sport, Level, Gender and School
Year. Teams are assigned to Organizations and Facilities, and referenced from
Schedules as the Home and Away sides.

#### Schedule

A planned game between a **Home Team** and an **Away Team** at a Facility, on a
date and time, for a particular Sport / Level / Gender. Optionally linked to a
NeST. Sometimes called a "Game" — they refer to the same thing; "Schedule" is
the planning view and "Game" is the live view.

A Schedule moves through these statuses:

- **Upcoming** — before the device latches, or for no-device schedules up to 5
  minutes before start.
- **Live** — the device has latched onto an active game, or for no-device
  schedules within 5 minutes of start.
- **Final** — final score has been submitted.
- **Missed** — 5 minutes after start with no signal, or 2 hours after start for
  no-device schedules with no finalization.

**Avoid:** "Match", "Event", "Fixture" — the canonical name is **Schedule**.

#### Season Schedule

A multi-game schedule template for a whole season, distinct from a one-off
Regular Schedule.

#### NeST

The Network Scoring Transmitter — the core hardware. It plugs into a scoreboard,
reads the live score, and broadcasts it to the platform, widgets, overlays and
livestreams. Each NeST has a **NeST number** and a unique **Serial**.

A NeST is either:

- **Physical NeST** — the hardware unit, shipped to the customer by Nevco.
- **Virtual NeST** — a software-only device with no hardware, driven from
  **ScoreBuddy**.

**Avoid:** "transmitter", "scorebird device", "box" — the canonical name is
**NeST**.

#### SB Config

A named configuration that tells a NeST how to read a particular scoreboard
manufacturer/model for a particular sport. The UI calls it **SB Config**; older
internal docs call the same thing a "Shadow" or "shadow parser". For a Virtual
NeST the SB Config is always `ScoreBuddy`.

#### Game Day

The live-ops view. It surfaces today's Schedules grouped by NeST, with filters
for date, sport, level, gender and search. Game Day only shows **Host
schedules** — schedules tied to a user-managed Facility or Device.

#### Association

A group of Organizations managed centrally by an **Association Admin**.
Membership in an Association automatically grants the Association Admin
admin-level access to every Organization in the Association. A named example is
**TAPPS**.

#### User Request

A user's pending application to be associated with an existing Organization. Has
three states: **Pending / Awaiting**, **Approved / Accepted**, **Denied**.

#### Widget / Overlay / ScoreSite

Public visual surfaces that display the live score from a NeST.

- **Widget** — an embeddable score module.
- **Overlay** — a graphics overlay for livestreams.
- **ScoreSite** — the public landing site for ScoreBuddy-driven scores.

#### Virtual Scoreboard

The page where a user generates and configures Widgets and Overlays for a
specific NeST.

#### Partner

External integrations the platform talks to:

- **Schedule import partners** feed schedule data in.
- **Video / streaming partners** receive score data out via an **API Key**.

### Users and Roles

Roles are **scoped per Organization**, except Super Admin, which is global, and
Association Admin, which is scoped per Association. The same person can be a
Member of Organization A and an Admin of Organization B.

#### Super Admin

Internal Scorebird staff. Highest possible role. Granted only to internal staff
— never to customers.

#### Admin

The standard owner role inside an Organization. Used by school athletic
directors and coaches who run their own teams and facilities.

#### Member

A regular user assigned to an Organization without full admin powers. Members
can view their Organization's data and today can also activate Devices, create
Teams, and create Facilities.

#### Association Admin

Manages a group of Organizations through an **Association**. Automatically gets
Admin-level access to every Organization in the Association.

#### User

A registered account that has not joined any Organization yet. Sees only the
**Get Started** screen.

#### Job Title

A profile attribute captured at sign-up. It does **not** grant or restrict
permissions.

**Avoid:** calling Job Title a "role".

## Relationships

- An **Organization** has many **Facilities**, **Teams**, **Users** and
  **Schedules**.
- A **Facility** belongs to one **Organization** and can have one **NeST**
  assigned and many **Teams** assigned.
- A **NeST** is assigned to one **Facility**. The **canonical home** of a Device
  is the **Facility**.
- A **Schedule** belongs to one **Facility**, references one Home **Team** and
  one Away **Team**, and optionally is linked to one **NeST**.
- A **Team** belongs to one **Organization** and can be assigned to many
  **Facilities** within that Organization.
- A **User** is assigned to many **Organizations**; in each one they hold a
  **role**.
- An **Association** has many **Organizations** and many **Association Admins**.
- A **User Request** targets one **Organization** and is resolved by an Admin of
  that Organization or by a Super Admin.
- A **Widget** / **Overlay** renders the score for one **NeST**.

## Flagged Ambiguities

Pause and clarify when these appear:

1. **"School" vs "Organization".** A School is one specific kind of
   Organization.
2. **"User Role" vs "Job Title".** Role means permission scope; Job Title is a
   profile attribute.
3. **"Game" vs "Schedule".** Same underlying entity, different context.
4. **"Broadcaster".** Can mean deprecated user mode or current Job Title.
5. **"SB Config" vs "Shadow".** Same configuration object.
6. **"District".** Legacy field on Schools only.
7. **"Past Games".** Treat as part of Schedules for new work unless told
   otherwise.
8. **"Pitch Count".** Deprecated.
9. **"Manually added Organization".** An Organization a Super Admin attached to
   an Association Admin outside Association membership.
10. **"PPF".** Purpose not documented — ask before using.
11. **"Activate Device" vs "Add Organization" State scoping.** Do not conflate.

<!-- END SCOREBIRD SHARED CONTEXT -->
