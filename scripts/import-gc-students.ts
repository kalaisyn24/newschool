/**
 * Imports students exported from GetCourse, marks the course as completed for them and issues certificates.
 *
 *   npx tsx --env-file=.env --conditions=react-server scripts/import-gc-students.ts <file.tsv> --course=<id> [--dry-run]
 *
 * file.tsv: one student per line — email<TAB>first name<TAB>last name (last name may be empty).
 * New users get a random password (they set their own via "Забыли пароль?") and a verified e-mail.
 * Existing users keep their name and password. Staff accounts (admin/support) are skipped.
 * Safe to re-run: enrollments, progress and certificates are only added when missing.
 */
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { joinName } from "../lib/validation";
import { logActivity } from "../lib/activity";
import { requestCertificate } from "../lib/learning";
import { issueGeneratedCertificate } from "../lib/certificates";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const courseId = args.find((a) => a.startsWith("--course="))?.split("=")[1];
const dryRun = args.includes("--dry-run");

const clean = (s = "") => s.replace(/[​-‍⁠﻿]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);

async function main() {
  if (!file || !courseId) throw new Error("Usage: import-gc-students.ts <file.tsv> --course=<id> [--dry-run]");
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { title: true, certificateEnabled: true, modules: { select: { lessons: { select: { id: true } } } } },
  });
  if (!course) throw new Error("Course not found");
  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });

  const rows = (await readFile(file, "utf8"))
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      const [email = "", first = "", last = ""] = l.split("\t");
      let firstName = clean(first);
      let lastName = clean(last);
      if (!firstName && lastName) [firstName, lastName] = [lastName.split(" ")[0], lastName.split(" ").slice(1).join(" ")];
      return { email: email.trim().toLowerCase(), firstName, lastName };
    });
  const invalid = rows.filter((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) || !r.firstName);
  if (invalid.length) throw new Error("Invalid rows: " + JSON.stringify(invalid));
  console.log(`Course: ${course.title}; lessons: ${lessonIds.length}; rows: ${rows.length}${dryRun ? " (dry run)" : ""}`);

  const stats = { created: 0, existing: 0, skippedStaff: 0, enrolled: 0, completed: 0, certificates: 0, certAlready: 0, certFailed: 0 };
  const failures: string[] = [];
  let n = 0;
  for (const r of rows) {
    n++;
    let user = await db.user.findUnique({ where: { email: r.email }, select: { id: true, role: true } });
    if (user && user.role !== "STUDENT") {
      stats.skippedStaff++;
      console.log(`skip staff ${r.email} (${user.role})`);
      continue;
    }
    if (dryRun) {
      user ? stats.existing++ : stats.created++;
      continue;
    }
    if (!user) {
      user = await db.user.create({
        data: {
          email: r.email,
          name: joinName(r.firstName, r.lastName),
          role: "STUDENT",
          passwordHash: await bcrypt.hash(randomBytes(24).toString("base64url"), 10),
          emailVerified: new Date(),
        },
        select: { id: true, role: true },
      });
      stats.created++;
    } else stats.existing++;
    const userId = user.id;
    const now = new Date();

    // Open access: active enrollment without expiry, course completed
    const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (!enrollment) {
      await db.enrollment.create({ data: { userId, courseId, grantedById: admin?.id, startedAt: now, completedAt: now } });
      stats.enrolled++;
    } else {
      await db.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "ACTIVE", expiresAt: null, completedAt: enrollment.completedAt ?? now, startedAt: enrollment.startedAt ?? now },
      });
    }

    // 100% progress
    if (lessonIds.length) {
      await db.lessonProgress.createMany({ data: lessonIds.map((lessonId) => ({ userId, lessonId })), skipDuplicates: true });
      await db.lessonProgress.updateMany({
        where: { userId, lessonId: { in: lessonIds }, completedAt: null },
        data: { completedAt: now, videoCompleted: true, testPassed: true },
      });
    }
    if (!enrollment?.completedAt) {
      await logActivity(userId, "course_completed", course.title, `/learn/courses/${courseId}`);
      stats.completed++;
    }

    // Certificate
    const { certificate } = await requestCertificate(userId, courseId);
    if (certificate.issuedAt && certificate.fileKey) stats.certAlready++;
    else {
      try {
        await issueGeneratedCertificate(certificate.id);
        stats.certificates++;
      } catch (e) {
        stats.certFailed++;
        failures.push(`${r.email}: ${e instanceof Error ? e.message : e}`);
      }
    }
    if (n % 25 === 0) console.log(`${n}/${rows.length}`, JSON.stringify(stats));
  }
  console.log("Done", JSON.stringify(stats));
  if (failures.length) console.log("Certificate failures:\n" + failures.join("\n"));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
