import PDFDocument from "pdfkit";
import { prisma } from "../src/db/prisma.js";
import { putObject, buckets } from "../src/lib/s3.js";
import { generateDataKey, wrapDataKey, encryptDocument, sha256 } from "../src/lib/crypto.js";
import { hashPassword } from "../src/lib/password.js";
import { renderDocument } from "../src/jobs/render.js";
import { logger } from "../src/lib/logger.js";

const DEMO_EMAIL = "demo@secureview.fr";
const DEMO_PASSWORD = "SecureView#Demo2026";
const RECIPIENT_EMAIL = "destinataire@example.com";
const RECIPIENT_NAME = "Camille Dupont";

async function buildSamplePdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 72 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pages = [
      {
        title: "SecureView — Note confidentielle",
        body: "Ce document de démonstration illustre le partage sécurisé en lecture seule.\n\nAucune copie de ce fichier n'est jamais transmise au destinataire : seules des images filigranées à son nom lui sont servies, page par page.",
      },
      {
        title: "Page 2 — Chiffres clés",
        body: "Chiffre d'affaires 2025 : 4,2 M€\nCroissance : +38%\nClients actifs : 126 cabinets et fonds d'investissement\n\nCes données sont fictives et à but de démonstration uniquement.",
      },
      {
        title: "Page 3 — Conditions de diffusion",
        body: "La consultation de ce document est tracée : identité, adresse IP et horodatage sont enregistrés à chaque page consultée.\n\nToute tentative d'impression ou de capture est journalisée. L'expéditeur peut révoquer l'accès à tout instant.",
      },
    ];

    pages.forEach((page, index) => {
      if (index > 0) doc.addPage();
      doc.fontSize(22).text(page.title, { align: "left" });
      doc.moveDown(1.5);
      doc.fontSize(13).text(page.body, { align: "left", lineGap: 6 });
    });

    doc.end();
  });
}

async function main() {
  logger.info("seed: démarrage");

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, passwordHash, name: "Compte de démonstration" },
  });

  const existing = await prisma.document.findFirst({
    where: { userId: user.id, title: "Note confidentielle — Démo" },
  });
  if (existing) {
    logger.info({ documentId: existing.id }, "seed: document de démo déjà présent, arrêt");
    return;
  }

  const pdfBuffer = await buildSamplePdf();
  const dataKey = generateDataKey();
  const { ciphertext, iv, authTag } = encryptDocument(pdfBuffer, dataKey);
  const checksum = sha256(pdfBuffer);

  const document = await prisma.document.create({
    data: {
      userId: user.id,
      title: "Note confidentielle — Démo",
      originalFilename: "note-confidentielle-demo.pdf",
      s3KeyEncrypted: "",
      dataKeyWrapped: wrapDataKey(dataKey),
      encryptionIv: iv,
      encryptionAuthTag: authTag,
      checksumSha256: checksum,
      status: "PENDING",
    },
  });

  const s3KeyEncrypted = `${document.id}/original.pdf.enc`;
  await putObject(buckets.documents, s3KeyEncrypted, ciphertext, "application/octet-stream");
  await prisma.document.update({ where: { id: document.id }, data: { s3KeyEncrypted } });

  await renderDocument(document.id);

  const share = await prisma.share.create({
    data: {
      documentId: document.id,
      recipientEmail: RECIPIENT_EMAIL,
      recipientName: RECIPIENT_NAME,
      canPrint: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  logger.info(
    {
      userEmail: DEMO_EMAIL,
      documentId: document.id,
      shareId: share.id,
      recipientEmail: RECIPIENT_EMAIL,
    },
    "seed: terminé",
  );

  // eslint-disable-next-line no-console
  console.log(`
Compte de démonstration créé :
  email    : ${DEMO_EMAIL}
  password : ${DEMO_PASSWORD}

Lien de démonstration destinataire (token de partage) :
  ${share.id}
  → http://localhost:5173/viewer/${share.id}
  destinataire : ${RECIPIENT_NAME} <${RECIPIENT_EMAIL}>
`);
}

main()
  .catch((err) => {
    logger.error({ err }, "seed: échec");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
