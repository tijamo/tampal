/**
 * @jest-environment node
 *
 * Integration tests that exercise the *real* RLS policies, grants, views and
 * SECURITY DEFINER functions defined in supabase/migrations/*.sql against a
 * throwaway local Postgres cluster (see harness.ts). Unlike the rest of the
 * suite, these assert what Postgres itself will and won't allow -- app-level
 * mocks can't catch a missing/overly-broad policy, only the database can.
 *
 * Skips automatically (with a console.warn) on machines without a local
 * Postgres server binary, so it never breaks `npm test` elsewhere.
 */
import { randomUUID } from "node:crypto";
import { rlsHarnessAvailable, startRlsCluster, type RlsCluster } from "./harness";

const harnessAvailable = rlsHarnessAvailable();
const d = harnessAvailable ? describe : describe.skip;

if (!harnessAvailable) {
  // eslint-disable-next-line no-console
  console.warn(
    "[rls.test] No local Postgres server binaries found -- skipping RLS integration tests.",
  );
}

const PERMISSION_DENIED = /permission denied|row-level security/i;

d("Row-Level Security policies", () => {
  jest.setTimeout(60_000);

  let cluster: RlsCluster;

  const adminUser = randomUUID();
  const adminPerson = randomUUID();
  const memberUser = randomUUID();
  const memberPerson = randomUUID();
  const otherUser = randomUUID();
  const otherPerson = randomUUID();
  const unlinkedUser = randomUUID(); // authenticated but no profiles.person_id
  const registerTakerUser = randomUUID();
  const registerTakerPerson = randomUUID();

  beforeAll(async () => {
    cluster = await startRlsCluster();

    await cluster.querySuper(
      `insert into auth.users (id) values ($1), ($2), ($3), ($4)`,
      [adminUser, memberUser, otherUser, registerTakerUser],
    );
    await cluster.querySuper(
      `insert into people (id, first_name, surname, person_type) values
         ($1, 'Alice', 'Admin', 'member'),
         ($2, 'Bob', 'Member', 'member'),
         ($3, 'Carol', 'Other', 'member'),
         ($4, 'Dana', 'Doorkeeper', 'member')`,
      [adminPerson, memberPerson, otherPerson, registerTakerPerson],
    );
    await cluster.querySuper(
      `update profiles set person_id = $2, role = 'admin' where user_id = $1`,
      [adminUser, adminPerson],
    );
    await cluster.querySuper(
      `update profiles set person_id = $2, role = 'member' where user_id = $1`,
      [memberUser, memberPerson],
    );
    await cluster.querySuper(
      `update profiles set person_id = $2, role = 'register_taker' where user_id = $1`,
      [registerTakerUser, registerTakerPerson],
    );
    await cluster.querySuper(
      `update profiles set person_id = $2, role = 'member' where user_id = $1`,
      [otherUser, otherPerson],
    );
    // unlinkedUser: create the auth.users row but no linked person.
    await cluster.querySuper(`insert into auth.users (id) values ($1)`, [unlinkedUser]);
  });

  afterAll(async () => {
    await cluster?.stop();
  });

  describe("people", () => {
    it("lets an admin see every person", async () => {
      const { rows } = await cluster.queryAs(adminUser, `select id from people order by id`);
      expect(rows.map((r) => r.id).sort()).toEqual(
        [adminPerson, memberPerson, otherPerson, registerTakerPerson].sort(),
      );
    });

    it("lets a member see only their own person row", async () => {
      const { rows } = await cluster.queryAs(memberUser, `select id from people`);
      expect(rows).toEqual([{ id: memberPerson }]);
    });

    it("blocks a member from updating another person's row", async () => {
      const { rowCount } = await cluster.queryAs(
        memberUser,
        `update people set first_name = 'Hacked' where id = $1`,
        [otherPerson],
      );
      expect(rowCount).toBe(0);
      const { rows } = await cluster.querySuper(`select first_name from people where id = $1`, [
        otherPerson,
      ]);
      expect(rows[0].first_name).toBe("Carol");
    });

    it("blocks a member from inserting a person directly", async () => {
      await expect(
        cluster.queryAs(
          memberUser,
          `insert into people (first_name, person_type) values ('Ghost', 'visitor')`,
        ),
      ).rejects.toThrow(PERMISSION_DENIED);
    });
  });

  describe("families", () => {
    it("lets any authenticated user read families", async () => {
      const { rows: created } = await cluster.querySuper(
        `insert into families (name) values ('The Test Family') returning id`,
      );
      const { rows } = await cluster.queryAs(memberUser, `select name from families where id = $1`, [
        created[0].id,
      ]);
      expect(rows).toEqual([{ name: "The Test Family" }]);
    });

    it("blocks a member from creating a family", async () => {
      await expect(
        cluster.queryAs(memberUser, `insert into families (name) values ('Rogue Family')`),
      ).rejects.toThrow(PERMISSION_DENIED);
    });

    it("blocks a member from renaming a family", async () => {
      const { rows: created } = await cluster.querySuper(
        `insert into families (name) values ('Original Name') returning id`,
      );
      const { rowCount } = await cluster.queryAs(
        memberUser,
        `update families set name = 'Hacked Name' where id = $1`,
        [created[0].id],
      );
      expect(rowCount).toBe(0);
    });

    it("lets an admin create a family, assign a member to it, and set the primary contact", async () => {
      const { rows: created } = await cluster.queryAs(
        adminUser,
        `insert into families (name) values ('The Admin Family') returning id`,
      );
      const familyId = created[0].id;

      await cluster.queryAs(adminUser, `update people set family_id = $1 where id = $2`, [
        familyId,
        memberPerson,
      ]);
      await cluster.queryAs(
        adminUser,
        `update families set primary_contact_person_id = $1 where id = $2`,
        [memberPerson, familyId],
      );

      const { rows } = await cluster.querySuper(
        `select f.primary_contact_person_id, p.family_id from families f join people p on p.id = $1 where f.id = $2`,
        [memberPerson, familyId],
      );
      expect(rows[0]).toEqual({ primary_contact_person_id: memberPerson, family_id: familyId });
    });
  });

  describe("profiles", () => {
    it("blocks a member from seeing another member's profile", async () => {
      const { rows } = await cluster.queryAs(
        memberUser,
        `select user_id from profiles where user_id = $1`,
        [otherUser],
      );
      expect(rows).toEqual([]);
    });

    it("blocks a member from escalating their own role to admin", async () => {
      const { rowCount } = await cluster.queryAs(
        memberUser,
        `update profiles set role = 'admin' where user_id = $1`,
        [memberUser],
      );
      expect(rowCount).toBe(0);
      const { rows } = await cluster.querySuper(`select role from profiles where user_id = $1`, [
        memberUser,
      ]);
      expect(rows[0].role).toBe("member");
    });
  });

  describe("meetings", () => {
    let meetingId: string;

    beforeAll(async () => {
      const { rows } = await cluster.querySuper(
        `insert into meetings (title, starts_at) values ('Bible Class', now()) returning id`,
      );
      meetingId = rows[0].id;
    });

    it("lets any authenticated user read meetings", async () => {
      const { rows } = await cluster.queryAs(memberUser, `select id from meetings where id = $1`, [
        meetingId,
      ]);
      expect(rows).toEqual([{ id: meetingId }]);
    });

    it("blocks a member from creating a meeting", async () => {
      await expect(
        cluster.queryAs(
          memberUser,
          `insert into meetings (title, starts_at) values ('Rogue Meeting', now())`,
        ),
      ).rejects.toThrow(PERMISSION_DENIED);
    });

    it("blocks a member from deleting a meeting", async () => {
      const { rowCount } = await cluster.queryAs(memberUser, `delete from meetings where id = $1`, [
        meetingId,
      ]);
      expect(rowCount).toBe(0);
    });
  });

  describe("attendance (Art. 9 special-category data)", () => {
    let meetingId: string;
    const occurrenceDate = "2026-01-05";

    beforeAll(async () => {
      const { rows } = await cluster.querySuper(
        `insert into meetings (title, starts_at) values ('Sunday Memorial', now()) returning id`,
      );
      meetingId = rows[0].id;
      await cluster.querySuper(
        `insert into attendance (meeting_id, occurrence_date, person_id, present) values ($1, $2, $3, true)`,
        [meetingId, occurrenceDate, otherPerson],
      );
    });

    it("blocks a plain member from reading another person's attendance", async () => {
      const { rows } = await cluster.queryAs(
        memberUser,
        `select person_id from attendance where meeting_id = $1 and person_id = $2`,
        [meetingId, otherPerson],
      );
      expect(rows).toEqual([]);
    });

    it("blocks a plain member from recording attendance", async () => {
      await expect(
        cluster.queryAs(
          memberUser,
          `insert into attendance (meeting_id, occurrence_date, person_id, present)
             values ($1, $2, $3, true)`,
          [meetingId, "2026-01-19", memberPerson],
        ),
      ).rejects.toThrow(PERMISSION_DENIED);
    });

    it("still lets a member read their own attendance (data subject access, unaffected by register_taker)", async () => {
      await cluster.querySuper(
        `insert into attendance (meeting_id, occurrence_date, person_id) values ($1, $2, $3)`,
        [meetingId, "2026-01-26", memberPerson],
      );
      const { rows } = await cluster.queryAs(
        memberUser,
        `select person_id from attendance where meeting_id = $1 and occurrence_date = $2`,
        [meetingId, "2026-01-26"],
      );
      expect(rows).toEqual([{ person_id: memberPerson }]);
    });

    it("lets a register_taker read and record anyone's attendance, including forging recorded_by", async () => {
      const { rows: readRows } = await cluster.queryAs(
        registerTakerUser,
        `select person_id from attendance where meeting_id = $1 and person_id = $2`,
        [meetingId, otherPerson],
      );
      expect(readRows).toEqual([{ person_id: otherPerson }]);

      const { rowCount } = await cluster.queryAs(
        registerTakerUser,
        `insert into attendance (meeting_id, occurrence_date, person_id, present, recorded_by)
           values ($1, $2, $3, true, $4)`,
        [meetingId, "2026-01-12", adminPerson, adminUser],
      );
      expect(rowCount).toBe(1);
    });

    it("still blocks a register_taker from deleting attendance (admin-only)", async () => {
      const { rowCount } = await cluster.queryAs(
        registerTakerUser,
        `delete from attendance where meeting_id = $1 and person_id = $2`,
        [meetingId, otherPerson],
      );
      expect(rowCount).toBe(0);
    });

    it("lets an admin delete attendance", async () => {
      const { rowCount } = await cluster.queryAs(
        adminUser,
        `delete from attendance where meeting_id = $1 and occurrence_date = $2 and person_id = $3`,
        [meetingId, "2026-01-12", adminPerson],
      );
      expect(rowCount).toBe(1);
    });
  });

  describe("consents", () => {
    it("blocks a member from reading another person's consents", async () => {
      await cluster.querySuper(
        `insert into consents (person_id, consent_type, granted, granted_at, captured_by)
           values ($1, 'directory_listing', true, now(), $2)`,
        [otherPerson, adminUser],
      );
      const { rows } = await cluster.queryAs(
        memberUser,
        `select person_id from consents where person_id = $1`,
        [otherPerson],
      );
      expect(rows).toEqual([]);
    });

    it("blocks a member from inserting a consent row directly (must go through the RPC)", async () => {
      await expect(
        cluster.queryAs(
          memberUser,
          `insert into consents (person_id, consent_type, granted) values ($1, 'directory_listing', true)`,
          [memberPerson],
        ),
      ).rejects.toThrow(PERMISSION_DENIED);
    });
  });

  describe("audit_log", () => {
    it("blocks a member from reading the audit log", async () => {
      const { rows } = await cluster.queryAs(memberUser, `select * from audit_log`);
      expect(rows).toEqual([]);
    });

    it("blocks a member from inserting into the audit log directly", async () => {
      await expect(
        cluster.queryAs(
          memberUser,
          `insert into audit_log (action, entity) values ('INSERT', 'people')`,
        ),
      ).rejects.toThrow(PERMISSION_DENIED);
    });

    it("records an admin's change via the trigger, visible to admins only", async () => {
      await cluster.queryAs(adminUser, `update people set notes = 'audited' where id = $1`, [
        adminPerson,
      ]);
      const { rows } = await cluster.queryAs(
        adminUser,
        `select entity, action from audit_log where entity = 'people' and entity_id = $1 order by at desc limit 1`,
        [adminPerson],
      );
      expect(rows[0]).toEqual({ entity: "people", action: "UPDATE" });
    });
  });

  describe("update_own_contact_details RPC", () => {
    it("lets a member update only their own contact details", async () => {
      await cluster.queryAs(
        memberUser,
        `select update_own_contact_details($1, $2, $3, $4, $5, $6, $7, $8)`,
        ["Bobby", "Membertson", "bob@example.com", "0123", null, null, null, null],
      );
      const { rows: mine } = await cluster.querySuper(
        `select first_name, surname, email from people where id = $1`,
        [memberPerson],
      );
      expect(mine[0]).toEqual({ first_name: "Bobby", surname: "Membertson", email: "bob@example.com" });

      const { rows: others } = await cluster.querySuper(`select first_name from people where id = $1`, [
        otherPerson,
      ]);
      expect(others[0].first_name).toBe("Carol");
    });

    it("rejects an empty first name", async () => {
      await expect(
        cluster.queryAs(
          memberUser,
          `select update_own_contact_details($1, $2, $3, $4, $5, $6, $7, $8)`,
          ["   ", null, null, null, null, null, null, null],
        ),
      ).rejects.toThrow(/name is required/i);
    });

    it("raises an exception for a user with no linked person record", async () => {
      await expect(
        cluster.queryAs(
          unlinkedUser,
          `select update_own_contact_details($1, $2, $3, $4, $5, $6, $7, $8)`,
          ["Nobody", null, null, null, null, null, null, null],
        ),
      ).rejects.toThrow(/not linked to a member record/i);
    });
  });

  describe("set_own_directory_consent RPC", () => {
    it("records an append-only consent, of the given type, tied to the caller's own person", async () => {
      await cluster.queryAs(memberUser, `select set_own_directory_consent($1, $2)`, [
        "directory_phone",
        true,
      ]);
      const { rows } = await cluster.querySuper(
        `select person_id, granted from consents where person_id = $1 and consent_type = 'directory_phone' order by created_at desc limit 1`,
        [memberPerson],
      );
      expect(rows[0]).toEqual({ person_id: memberPerson, granted: true });
    });

    it("independently tracks phone, email and address consent", async () => {
      await cluster.queryAs(memberUser, `select set_own_directory_consent($1, $2)`, [
        "directory_email",
        true,
      ]);
      const { rows } = await cluster.querySuper(
        `select consent_type, granted from consents where person_id = $1 and consent_type in ('directory_phone', 'directory_email', 'directory_address')`,
        [memberPerson],
      );
      const byType = Object.fromEntries(rows.map((r) => [r.consent_type, r.granted]));
      expect(byType.directory_phone).toBe(true);
      expect(byType.directory_email).toBe(true);
      expect(byType.directory_address).toBeUndefined();
    });

    it("rejects a consent_type outside the directory allowlist (can't be used to set unrelated consents)", async () => {
      await expect(
        cluster.queryAs(memberUser, `select set_own_directory_consent($1, $2)`, [
          "attendance_records",
          true,
        ]),
      ).rejects.toThrow(/invalid consent type/i);
    });
  });

  describe("erase_person_data RPC", () => {
    it("blocks a member from erasing someone else's data", async () => {
      await expect(
        cluster.queryAs(memberUser, `select erase_person_data($1)`, [otherPerson]),
      ).rejects.toThrow(/only erase your own data/i);

      const { rows } = await cluster.querySuper(`select first_name from people where id = $1`, [
        otherPerson,
      ]);
      expect(rows[0].first_name).toBe("Carol");
    });

    it("blocks a user with no linked person record from erasing anything", async () => {
      await expect(
        cluster.queryAs(unlinkedUser, `select erase_person_data($1)`, [memberPerson]),
      ).rejects.toThrow(/only erase your own data/i);
    });

    it("lets a member erase their own data, clearing PII, tags and family_id, and soft-deleting", async () => {
      const selfErasePerson = randomUUID();
      const selfEraseUser = randomUUID();
      await cluster.querySuper(`insert into auth.users (id) values ($1)`, [selfEraseUser]);
      const { rows: familyRows } = await cluster.querySuper(
        `insert into families (name) values ('The Eraseme Family') returning id`,
      );
      await cluster.querySuper(
        `insert into people (id, first_name, surname, person_type, email, tags, family_id)
           values ($1, 'Erin', 'Eraseme', 'member', 'erin@example.com', array['Members'], $2)`,
        [selfErasePerson, familyRows[0].id],
      );
      await cluster.querySuper(
        `update profiles set person_id = $2, role = 'member' where user_id = $1`,
        [selfEraseUser, selfErasePerson],
      );

      await cluster.queryAs(selfEraseUser, `select erase_person_data($1)`, [selfErasePerson]);

      const { rows } = await cluster.querySuper(
        `select first_name, surname, email, tags, family_id, deleted_at is not null as erased
           from people where id = $1`,
        [selfErasePerson],
      );
      expect(rows[0]).toEqual({
        first_name: "Erased record",
        surname: null,
        email: null,
        tags: [],
        family_id: null,
        erased: true,
      });
    });

    it("lets an admin erase anyone's data", async () => {
      const targetPerson = randomUUID();
      await cluster.querySuper(
        `insert into people (id, first_name, person_type, email) values ($1, 'Temp', 'visitor', 'temp@example.com')`,
        [targetPerson],
      );

      await cluster.queryAs(adminUser, `select erase_person_data($1)`, [targetPerson]);

      const { rows } = await cluster.querySuper(
        `select first_name, email from people where id = $1`,
        [targetPerson],
      );
      expect(rows[0]).toEqual({ first_name: "Erased record", email: null });
    });
  });

  describe("people_directory / register_eligible_people views", () => {
    const visitorId = randomUUID();

    beforeAll(async () => {
      await cluster.querySuper(
        `insert into people (id, first_name, person_type, phone, email, address_line1, city, postcode)
           values ($1, 'Vinny', 'visitor', '0999', 'vinny@example.com', '1 Vine St', 'Tamworth', 'B79 1AA')`,
        [visitorId],
      );
    });

    it("hides phone/email/address in the directory until each consent is independently granted", async () => {
      const before = await cluster.queryAs(
        memberUser,
        `select phone, email, address_line1 from people_directory where id = $1`,
        [visitorId],
      );
      expect(before.rows[0]).toEqual({ phone: null, email: null, address_line1: null });

      await cluster.querySuper(
        `insert into consents (person_id, consent_type, granted, granted_at) values ($1, 'directory_phone', true, now())`,
        [visitorId],
      );
      const phoneOnly = await cluster.queryAs(
        memberUser,
        `select phone, email, address_line1 from people_directory where id = $1`,
        [visitorId],
      );
      expect(phoneOnly.rows[0]).toEqual({ phone: "0999", email: null, address_line1: null });

      await cluster.querySuper(
        `insert into consents (person_id, consent_type, granted, granted_at) values
           ($1, 'directory_email', true, now()), ($1, 'directory_address', true, now())`,
        [visitorId],
      );
      const all = await cluster.queryAs(
        memberUser,
        `select phone, email, address_line1 from people_directory where id = $1`,
        [visitorId],
      );
      expect(all.rows[0]).toEqual({
        phone: "0999",
        email: "vinny@example.com",
        address_line1: "1 Vine St",
      });
    });

    it("hides a field again once its consent is withdrawn, independently of the others (latest consent wins)", async () => {
      await cluster.querySuper(
        `insert into consents (person_id, consent_type, granted, withdrawn_at) values ($1, 'directory_phone', false, now())`,
        [visitorId],
      );
      const { rows } = await cluster.queryAs(
        memberUser,
        `select phone, email, address_line1 from people_directory where id = $1`,
        [visitorId],
      );
      expect(rows[0]).toEqual({
        phone: null,
        email: "vinny@example.com",
        address_line1: "1 Vine St",
      });
    });

    it("excludes soft-deleted people from the directory", async () => {
      await cluster.querySuper(`update people set deleted_at = now() where id = $1`, [visitorId]);
      const { rows } = await cluster.queryAs(
        memberUser,
        `select id from people_directory where id = $1`,
        [visitorId],
      );
      expect(rows).toEqual([]);
    });

    it("only lists people with a current attendance_records consent as register-eligible", async () => {
      const eligibleId = randomUUID();
      await cluster.querySuper(
        `insert into people (id, first_name, person_type) values ($1, 'Eligible', 'visitor')`,
        [eligibleId],
      );
      await cluster.querySuper(
        `insert into consents (person_id, consent_type, granted, granted_at) values ($1, 'attendance_records', true, now())`,
        [eligibleId],
      );

      const { rows } = await cluster.queryAs(
        memberUser,
        `select id from register_eligible_people where id = $1`,
        [eligibleId],
      );
      expect(rows).toEqual([{ id: eligibleId }]);

      await cluster.querySuper(
        `insert into consents (person_id, consent_type, granted, withdrawn_at) values ($1, 'attendance_records', false, now())`,
        [eligibleId],
      );
      const { rows: afterWithdraw } = await cluster.queryAs(
        memberUser,
        `select id from register_eligible_people where id = $1`,
        [eligibleId],
      );
      expect(afterWithdraw).toEqual([]);
    });
  });

  describe("maintenance RPCs (purge_stale_visitor_contacts / purge_erased_people)", () => {
    it("blocks an authenticated member from calling purge_erased_people directly", async () => {
      await expect(
        cluster.queryAs(memberUser, `select purge_erased_people(0)`),
      ).rejects.toThrow(PERMISSION_DENIED);
    });

    it("blocks an authenticated member from calling purge_stale_visitor_contacts directly", async () => {
      await expect(
        cluster.queryAs(memberUser, `select purge_stale_visitor_contacts(0)`),
      ).rejects.toThrow(PERMISSION_DENIED);
    });

    it("as superuser, purge_erased_people hard-deletes only people past the grace window", async () => {
      const recentlyErased = randomUUID();
      const longErased = randomUUID();
      await cluster.querySuper(
        `insert into people (id, first_name, person_type, deleted_at) values
           ($1, 'RecentlyErased', 'visitor', now() - interval '1 day'),
           ($2, 'LongErased', 'visitor', now() - interval '40 days')`,
        [recentlyErased, longErased],
      );

      await cluster.querySuper(`select purge_erased_people(30)`);

      const { rows } = await cluster.querySuper(
        `select id from people where id in ($1, $2)`,
        [recentlyErased, longErased],
      );
      expect(rows.map((r) => r.id)).toEqual([recentlyErased]);
    });

    it("as superuser, purge_stale_visitor_contacts strips contact fields only for stale, non-attending visitors", async () => {
      const staleVisitor = randomUUID();
      const recentVisitor = randomUUID();
      await cluster.querySuper(
        `insert into people (id, first_name, person_type, email, phone, created_at) values
           ($1, 'StaleVisitor', 'visitor', 'stale@example.com', '111', now() - interval '30 months'),
           ($2, 'RecentVisitor', 'visitor', 'recent@example.com', '222', now() - interval '30 months')`,
        [staleVisitor, recentVisitor],
      );
      const { rows: meetingRows } = await cluster.querySuper(
        `insert into meetings (title, starts_at) values ('Retention Test Meeting', now()) returning id`,
      );
      await cluster.querySuper(
        `insert into attendance (meeting_id, occurrence_date, person_id) values ($1, current_date, $2)`,
        [meetingRows[0].id, recentVisitor],
      );

      await cluster.querySuper(`select purge_stale_visitor_contacts(24)`);

      const { rows } = await cluster.querySuper(
        `select id, email, phone from people where id in ($1, $2) order by id`,
        [staleVisitor, recentVisitor],
      );
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(byId[staleVisitor]).toEqual({ id: staleVisitor, email: null, phone: null });
      expect(byId[recentVisitor]).toEqual({ id: recentVisitor, email: "recent@example.com", phone: "222" });
    });
  });
});
