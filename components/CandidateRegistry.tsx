import React, { useState, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Candidate, RecruitmentStatus, DocumentStatus, UploadedSupplementalDocument } from "../types";

interface RegistryProps {
  candidates: Candidate[];
  onAdd: (c: Candidate) => void;
  onUpdate: (c: Candidate) => void;
  onDelete: (id: string) => void;
  mode?: "registry" | "database";
}

const CandidateRegistry: React.FC<RegistryProps> = ({
  candidates,
  onAdd,
  onUpdate,
  onDelete,
  mode = "registry",
}) => {
  const fallbackImage = (name: string) =>
    `https://ui-avatars.com/api/?background=003366&color=ffffff&name=${encodeURIComponent(name)}`;
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    RecruitmentStatus | "ALL"
  >("ALL");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] =
    useState<Candidate | null>(null);
  const [editingCandidate, setEditingCandidate] =
    useState<Candidate | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [supplementalPreview, setSupplementalPreview] = useState<UploadedSupplementalDocument | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const supplementalRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || "");
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });

  const getSupplementalFiles = (candidate: Partial<Candidate> | Candidate | null | undefined) =>
    candidate?.documents?.supplementalFiles || [];

  const getDocumentStatuses = (documents: Candidate["documents"] | undefined) => ({
    cv: documents?.cv || "NONE",
    certificates: documents?.certificates || "NONE",
    id: documents?.id || "NONE",
    tin: documents?.tin || "NONE",
    supplemental: documents?.supplemental || (documents?.supplementalFiles?.length ? "COMPLETE" : "NONE"),
  });

  const formatDocumentLabel = (docKey: string) => {
    switch (docKey) {
      case "cv":
        return "CV";
      case "id":
        return "ID Card / License";
      case "certificates":
        return "Certificates";
      case "tin":
        return "TIN";
      case "supplemental":
        return "Supplemental Docs";
      default:
        return docKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    }
  };

  const getImageDimensions = (dataUrl: string) =>
    new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({
          width: img.naturalWidth || 1000,
          height: img.naturalHeight || 1000,
        });
      img.onerror = () => resolve({ width: 1000, height: 1000 });
      img.src = dataUrl;
    });

  const canInlinePreview = (doc: UploadedSupplementalDocument) =>
    doc.mimeType.startsWith("image/") || doc.mimeType === "application/pdf";

  const safeImageData = async (url?: string) => {
    if (!url) return null;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      const data = await new Promise<string>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 300;
          canvas.height = img.naturalHeight || 300;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("No canvas context"));
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        };
        img.onerror = reject;
        img.src = url;
      });
      return data;
    } catch {
      return null;
    }
  };

  const [newCandidate, setNewCandidate] = useState<Partial<Candidate>>({
    fullName: "",
    gender: "M",
    phone: "",
    email: "",
    address: "",
    dob: "",
    occupation: "",
    experienceYears: 0,
    positionApplied: "",
    status: RecruitmentStatus.PENDING,
    skills: [],
    documents: {
      cv: "NONE",
      id: "NONE",
      certificates: "NONE",
      tin: "NONE",
      supplemental: "NONE",
      supplementalFiles: [],
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const supplementalFiles = getSupplementalFiles(newCandidate);
    const nextDocumentStatus: DocumentStatus = {
      ...(newCandidate.documents as DocumentStatus),
      supplemental: supplementalFiles.length ? "COMPLETE" : "NONE",
      supplementalFiles,
    };

    const candidate: Candidate = {
      id: editingCandidate ? editingCandidate.id :
        `ZGL-CN-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      fullName: newCandidate.fullName || '',
      gender: newCandidate.gender as 'M' | 'F' || 'M',
      phone: newCandidate.phone || '',
      email: newCandidate.email || '',
      dob: newCandidate.dob || '1990-01-01',
      age: 30, // Calculate age based on DOB ideally
      address: newCandidate.address || 'Registered Office',
      occupation: newCandidate.occupation || 'Candidate',
      experienceYears: newCandidate.experienceYears || 0,
      positionApplied: newCandidate.positionApplied || 'General Application',
      status: newCandidate.status || RecruitmentStatus.PENDING,
      documents: nextDocumentStatus,
      skills: newCandidate.skills || [],
      createdAt: editingCandidate?.createdAt || new Date().toISOString(),
      photoUrl: previewImage || editingCandidate?.photoUrl || fallbackImage(newCandidate.fullName || "Candidate"),
    };

    if (editingCandidate) {
      onUpdate(candidate);
    } else {
      onAdd(candidate);
    }

    setIsFormOpen(false);
    setEditingCandidate(null);
    setPreviewImage(null);
    setSupplementalPreview(null);
    setNewCandidate({
      fullName: "",
      gender: "M",
      phone: "",
      email: "",
      address: "",
      dob: "",
      occupation: "",
      experienceYears: 0,
      positionApplied: "",
      status: RecruitmentStatus.PENDING,
      skills: [],
      documents: {
        cv: "NONE",
        id: "NONE",
        certificates: "NONE",
        tin: "NONE",
        supplemental: "NONE",
        supplementalFiles: [],
      },
    });
  };

  const getStatusColor = (status: RecruitmentStatus) => {
    switch (status) {
      case RecruitmentStatus.INTERVIEW:
        return "bg-indigo-100 text-indigo-700";
      case RecruitmentStatus.TRAINING:
        return "bg-amber-100 text-amber-700";
      case RecruitmentStatus.DEPLOYMENT:
        return "bg-green-100 text-green-700";
      default:
        return "bg-slate-200 text-slate-700";
    }
  };

  const handlePDFDownload = async (includeSupplemental: boolean) => {
    if (!selectedCandidate) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const colorBlue: [number, number, number] = [0, 51, 102];
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), "F");

    pdf.setTextColor(...colorBlue);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("ZAYA GROUP CANDIDATE DOSSIER", 14, 16);
    pdf.setDrawColor(212, 175, 55);
    pdf.setLineWidth(0.6);
    pdf.line(14, 19, 196, 19);

    const photoData = await safeImageData(selectedCandidate.photoUrl || fallbackImage(selectedCandidate.fullName));
    if (photoData) {
      try {
        pdf.addImage(photoData, "JPEG", 14, 24, 34, 34);
      } catch {
        // keep PDF generation successful even if image decode fails
      }
    }

    pdf.setFontSize(15);
    pdf.text(selectedCandidate.fullName, 52, 30);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Reference: ${selectedCandidate.id}`, 52, 37);
    pdf.text(`Occupation: ${selectedCandidate.occupation}`, 52, 43);
    pdf.text(`Status: ${selectedCandidate.status}`, 52, 49);
    pdf.text(`Position Applied: ${selectedCandidate.positionApplied}`, 52, 55);

    autoTable(pdf, {
      startY: 64,
      theme: "grid",
      head: [["Field", "Value"]],
      body: [
        ["Email", selectedCandidate.email || "-"],
        ["Phone", selectedCandidate.phone || "-"],
        ["DOB", selectedCandidate.dob || "-"],
        ["Age", String(selectedCandidate.age ?? "-")],
        ["Address", selectedCandidate.address || "-"],
        ["Experience (Years)", String(selectedCandidate.experienceYears ?? "-")],
        ["Skills", (selectedCandidate.skills || []).join(", ") || "None"],
      ],
      styles: { fontSize: 10, textColor: [0, 51, 102], cellPadding: 3 },
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      margin: { left: 14, right: 14 },
    });

    const documentStatuses = getDocumentStatuses(selectedCandidate.documents);

    autoTable(pdf, {
      startY: (pdf as any).lastAutoTable.finalY + 6,
      theme: "grid",
      head: [["Document", "Status"]],
      body: Object.entries(documentStatuses).map(([doc, status]) => [
        formatDocumentLabel(doc),
        status,
      ]),
      styles: { fontSize: 10, textColor: [0, 51, 102], cellPadding: 3 },
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      margin: { left: 14, right: 14 },
    });

    if (includeSupplemental) {
      const supplementalFiles = getSupplementalFiles(selectedCandidate);
      pdf.addPage();
      pdf.setTextColor(...colorBlue);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("SUPPLEMENTAL DOCS", 14, 18);
      autoTable(pdf, {
        startY: 24,
        theme: "grid",
        head: [["Attached Document", "Type", "Size (KB)"]],
        body: supplementalFiles.length
          ? supplementalFiles.map((doc) => [
            doc.name,
            doc.mimeType || "Unknown",
            (doc.size / 1024).toFixed(1),
          ])
          : [["No supplemental files uploaded", "-", "-"]],
        styles: { fontSize: 10, textColor: [0, 51, 102], cellPadding: 3 },
        headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 252] },
        margin: { left: 14, right: 14 },
      });

      for (let i = 0; i < supplementalFiles.length; i += 1) {
        const doc = supplementalFiles[i];
        pdf.addPage();
        pdf.setTextColor(...colorBlue);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text(`Attachment ${i + 1} of ${supplementalFiles.length}`, 14, 14);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.text(doc.name, 14, 21);

        if (doc.mimeType.startsWith("image/")) {
          const imageData = (await safeImageData(doc.dataUrl)) || doc.dataUrl;
          const { width, height } = await getImageDimensions(doc.dataUrl);
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const margin = 14;
          const top = 28;
          const maxWidth = pageWidth - margin * 2;
          const maxHeight = pageHeight - top - margin;
          const scale = Math.min(maxWidth / width, maxHeight / height);
          const renderWidth = width * scale;
          const renderHeight = height * scale;
          const x = (pageWidth - renderWidth) / 2;
          const y = top + (maxHeight - renderHeight) / 2;
          try {
            pdf.addImage(imageData, "JPEG", x, y, renderWidth, renderHeight);
          } catch {
            pdf.setFontSize(10);
            pdf.text("Unable to render this image attachment in the PDF export.", 14, 32);
          }
        } else {
          autoTable(pdf, {
            startY: 30,
            theme: "grid",
            head: [["File", "Value"]],
            body: [
              ["Name", doc.name],
              ["Type", doc.mimeType || "Unknown"],
              ["Size (KB)", (doc.size / 1024).toFixed(1)],
              ["Uploaded", new Date(doc.uploadedAt).toLocaleString()],
            ],
            styles: { fontSize: 10, textColor: [0, 51, 102], cellPadding: 3 },
            headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [245, 247, 252] },
            margin: { left: 14, right: 14 },
          });
        }
      }
    }

    pdf.save(`${selectedCandidate.fullName.replace(/\s+/g, "_")}_Dossier.pdf`);
  };

  const handleBulkDownload = () => {
    const targetCandidates = filteredCandidates.length > 0 ? filteredCandidates : candidates;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("ZAYA Group Recruitment Database", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["ID", "Name", "Role", "Exp (Yrs)", "Status", "Docs"];
    const tableRows: any[] = [];

    targetCandidates.forEach(candidate => {
      const completedDocs = Object.values(getDocumentStatuses(candidate.documents)).filter((d) => d === 'COMPLETE').length;
      const candidateData = [
        candidate.id,
        candidate.fullName,
        candidate.occupation,
        candidate.experienceYears,
        candidate.status,
        `${completedDocs}/5`
      ];
      tableRows.push(candidateData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold' }, // Enterprise Blue
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`zaya_candidates_db_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handlePrint = (includeSupplemental: boolean) => {
    if (!selectedCandidate) return;
    const printable = window.open("", "_blank", "width=1000,height=900");
    if (!printable) return;

    const docStatuses = getDocumentStatuses(selectedCandidate.documents);
    const supplementalFiles = includeSupplemental ? getSupplementalFiles(selectedCandidate) : [];
    const supplementalMarkup = supplementalFiles.length
      ? supplementalFiles
        .map((doc) => {
          if (doc.mimeType.startsWith("image/")) {
            return `<div style="margin-bottom:16px;"><p><strong>${doc.name}</strong></p><img src="${doc.dataUrl}" alt="${doc.name}" style="max-width:100%;max-height:320px;"/></div>`;
          }
          if (doc.mimeType === "application/pdf") {
            return `<div style="margin-bottom:16px;"><p><strong>${doc.name}</strong></p><iframe src="${doc.dataUrl}" style="width:100%;height:420px;border:1px solid #ccc;"></iframe></div>`;
          }
          return `<p><strong>${doc.name}</strong> (${doc.mimeType || "Unknown"})</p>`;
        })
        .join("")
      : "<p>No supplemental files uploaded.</p>";

    printable.document.write(`
      <html>
        <head>
          <title>${selectedCandidate.fullName} Profile</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
            h1, h2 { margin: 0 0 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            td, th { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
            .header { display: flex; gap: 16px; align-items: center; margin-bottom: 20px; }
            .photo { width: 120px; height: 120px; border-radius: 16px; object-fit: cover; border: 2px solid #d4af37; }
          </style>
        </head>
        <body>
          <div class="header">
            <img class="photo" src="${selectedCandidate.photoUrl || fallbackImage(selectedCandidate.fullName)}" alt="${selectedCandidate.fullName}" />
            <div>
              <h1>${selectedCandidate.fullName}</h1>
              <p>${selectedCandidate.occupation} | ${selectedCandidate.status}</p>
              <p>Reference: ${selectedCandidate.id}</p>
            </div>
          </div>
          <h2>Profile</h2>
          <table>
            <tr><th>Email</th><td>${selectedCandidate.email || "-"}</td></tr>
            <tr><th>Phone</th><td>${selectedCandidate.phone || "-"}</td></tr>
            <tr><th>DOB</th><td>${selectedCandidate.dob || "-"}</td></tr>
            <tr><th>Address</th><td>${selectedCandidate.address || "-"}</td></tr>
            <tr><th>Position Applied</th><td>${selectedCandidate.positionApplied || "-"}</td></tr>
            <tr><th>Skills</th><td>${(selectedCandidate.skills || []).join(", ") || "None"}</td></tr>
          </table>
          <h2 style="margin-top:20px;">Document Status</h2>
          <table>
            ${Object.entries(docStatuses).map(([doc, status]) => `<tr><th>${formatDocumentLabel(doc)}</th><td>${status}</td></tr>`).join("")}
          </table>
          ${includeSupplemental ? `<h2 style="margin-top:20px;">Supplemental Documents</h2>${supplementalMarkup}` : ""}
        </body>
      </html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
  };

  const toggleDoc = (key: "cv" | "certificates" | "id" | "tin") => {
    setNewCandidate((prev) => ({
      ...prev,
      documents: {
        ...prev.documents!,
        [key]:
          prev.documents![key] === "COMPLETE" ? "NONE" : "COMPLETE",
      },
    }));
  };

  const filteredCandidates = candidates.filter(
    (c) =>
      (c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterStatus === "ALL" || c.status === filterStatus)
  );

  return (
    <div className="space-y-4 text-slate-900 dark:text-blue-100 print:text-[#003366]">

      {/* HEADER */}
      <div className="flex flex-col gap-4 bg-white dark:bg-[#0f1a2e] p-6 rounded-3xl border border-slate-200 dark:border-[#1e3a5f] shadow-sm print:hidden">
        <div className="flex justify-between items-center">
           <h2 className="text-2xl font-black text-[#0f172a] dark:text-blue-200 uppercase tracking-tight">Candidate Registry</h2>
           <div className="flex gap-2">
            {mode === "database" && (
              <>
                <button
                  onClick={() => importRef.current?.click()}
                  disabled={isImporting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:brightness-110 transition-all disabled:opacity-60"
                >
                  <i className="fas fa-file-import mr-2"></i> {isImporting ? "Importing..." : "Import CSV/Excel"}
                </button>
                <button
                  onClick={handleBulkDownload}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-900/20 hover:brightness-110 transition-all"
                >
                  <i className="fas fa-download mr-2"></i> Download Database
                </button>
              </>
            )}
            <button
              onClick={() => setIsFormOpen(true)}
              className="px-6 py-3 bg-gold text-enterprise-blue rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-gold/20 hover:brightness-110 transition-all"
            >
              <i className="fas fa-plus mr-2"></i> Add Candidate
            </button>
           </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-[#0a1628] border border-slate-200 dark:border-[#1e3a5f] dark:text-white font-bold outline-none focus:ring-2 focus:ring-gold/20"
              placeholder="Search by Name or Reference ID..."
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
            {[
              { label: 'All', value: 'ALL' },
              { label: 'Pending', value: RecruitmentStatus.PENDING },
              { label: 'Interview', value: RecruitmentStatus.INTERVIEW },
              { label: 'Training', value: RecruitmentStatus.TRAINING },
              { label: 'Deployment', value: RecruitmentStatus.DEPLOYMENT },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value as any)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                  filterStatus === opt.value 
                  ? 'bg-enterprise-blue text-white shadow-md' 
                  : 'bg-slate-100 dark:bg-[#132445] text-slate-600 dark:text-blue-200 hover:bg-slate-200 dark:hover:bg-[#1d325b]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {mode === "database" && (
        <input
          ref={importRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImportSheet(file);
            }
            e.currentTarget.value = "";
          }}
        />
      )}

      {/* TABLE */}
      <div className="bg-white dark:bg-[#0f1a2e] rounded-xl border border-slate-200 dark:border-[#1e3a5f] overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-slate-100 dark:bg-[#132445]">
            <tr>
              <th className="p-4 text-left text-xs font-black">Reference</th>
              <th className="p-4 text-left text-xs font-black">Profile</th>
              <th className="p-4 text-left text-xs font-black">Name</th>
              <th className="p-4 text-left text-xs font-black">
                Occupation
              </th>
              <th className="p-4 text-left text-xs font-black">
                Documents
              </th>
              <th className="p-4 text-center text-xs font-black">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredCandidates.map((c) => (
              <tr key={c.id} className="border-b dark:border-[#1e3a5f]">
                <td className="p-4 font-mono text-xs font-bold dark:text-white">
                  {c.id}
                </td>
                <td className="p-4">
                  <img
                    src={c.photoUrl || fallbackImage(c.fullName)}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = fallbackImage(c.fullName);
                    }}
                  />
                </td>
                <td className="p-4 font-black dark:text-white">
                  {c.fullName}
                </td>
                <td className="p-4 dark:text-white">
                  {c.occupation}
                </td>
                <td className="p-4 flex gap-1 flex-wrap">
                  {Object.entries(getDocumentStatuses(c.documents)).map(([doc, status]) => (
                    <span
                      key={doc}
                      className={`px-2 py-1 text-[9px] font-black rounded-full ${
                        status === "COMPLETE"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {formatDocumentLabel(doc)}
                    </span>
                  ))}
                </td>
                <td className="p-4 text-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedCandidate(c);
                      setIsProfileOpen(true);
                    }}
                    className="text-blue-500"
                  >
                    <i className="fas fa-eye"></i>
                  </button>

                  <button
                    onClick={() => {
                      setEditingCandidate(c);
                      setNewCandidate({
                        fullName: c.fullName,
                        gender: c.gender,
                        phone: c.phone,
                        email: c.email,
                        address: c.address,
                        dob: c.dob,
                        occupation: c.occupation,
                        experienceYears: c.experienceYears,
                        positionApplied: c.positionApplied,
                        status: c.status,
                        skills: c.skills,
                        documents: {
                          ...c.documents,
                          supplemental: c.documents.supplemental || (c.documents.supplementalFiles?.length ? "COMPLETE" : "NONE"),
                          supplementalFiles: c.documents.supplementalFiles || [],
                        },
                      });
                      setPreviewImage(c.photoUrl || null);
                      setSupplementalPreview(null);
                      setIsFormOpen(true);
                    }}
                    className="text-yellow-500"
                  >
                    <i className="fas fa-edit"></i>
                  </button>

                  <button
                    onClick={() => onDelete(c.id)}
                    className="text-red-500"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FORM MODAL */}
      {isFormOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setIsFormOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#0f1a2e] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar border dark:border-[#1e3a5f]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b dark:border-[#1e3a5f] flex justify-between items-center bg-slate-50 dark:bg-[#0f1a2e]/50 sticky top-0 z-10">
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">
                {editingCandidate ? "Edit Candidate" : "New Candidate Enrollment"}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-8 space-y-8">
              {/* Profile Image Section */}
              <div className="flex flex-col items-center">
                <div className="relative group cursor-pointer">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      className="w-32 h-32 rounded-[2rem] object-cover border-4 border-gold shadow-xl"
                      alt="Preview"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-[2rem] bg-slate-100 dark:bg-[#132445] border-4 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:border-gold hover:text-gold transition-all">
                      <i className="fas fa-camera text-3xl mb-2"></i>
                      <span className="text-[8px] font-black uppercase">
                        Upload Profile
                      </span>
                    </div>
                  )}
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        const reader = new FileReader();
                        reader.onload = (ev) =>
                          setPreviewImage(ev.target?.result as string);
                        reader.readAsDataURL(e.target.files[0]);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest border-b dark:border-[#1e3a5f] pb-2">
                  Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Full Name
                    </label>
                    <input
                      required
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      placeholder="Full Legal Name"
                      value={newCandidate.fullName}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          fullName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Email Address
                    </label>
                    <input
                      required
                      type="email"
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      placeholder="email@example.com"
                      value={newCandidate.email}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          email: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Phone Number
                    </label>
                    <input
                      required
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      placeholder="+255..."
                      value={newCandidate.phone}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      value={newCandidate.dob}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          dob: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Gender
                    </label>
                    <select
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      value={newCandidate.gender}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          gender: e.target.value as "M" | "F",
                        })
                      }
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Status
                    </label>
                    <select
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      value={newCandidate.status}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          status: e.target.value as RecruitmentStatus,
                        })
                      }
                    >
                      <option value={RecruitmentStatus.PENDING}>Pending</option>
                      <option value={RecruitmentStatus.INTERVIEW}>Interview</option>
                      <option value={RecruitmentStatus.TRAINING}>Training</option>
                      <option value={RecruitmentStatus.DEPLOYMENT}>Deployment</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Address
                    </label>
                    <input
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      placeholder="Residential Address"
                      value={newCandidate.address}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          address: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Professional Experience & Skills */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest border-b dark:border-[#1e3a5f] pb-2">
                  Professional Experience & Skills
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-1">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Occupation
                    </label>
                    <input
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      placeholder="Current Role"
                      value={newCandidate.occupation}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          occupation: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Experience (Years)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      placeholder="0"
                      value={newCandidate.experienceYears}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          experienceYears: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Position Applied For
                    </label>
                    <input
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      placeholder="Target Position"
                      value={newCandidate.positionApplied}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          positionApplied: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Skills (Comma Separated)
                    </label>
                    <input
                      className="w-full p-4 rounded-2xl border dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
                      placeholder="e.g. React, Node.js, Project Management"
                      value={newCandidate.skills?.join(", ")}
                      onChange={(e) =>
                        setNewCandidate({
                          ...newCandidate,
                          skills: e.target.value.split(",").map((s) => s.trim()),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Documentation Checklist */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest border-b dark:border-[#1e3a5f] pb-2">
                  Required Documentation
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {(["cv", "certificates", "id", "tin"] as const).map(
                    (key) => (
                      <div
                        key={key}
                        onClick={() => toggleDoc(key)}
                        className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                          newCandidate.documents![key] === "COMPLETE"
                            ? "border-gold bg-gold/10"
                            : "border-slate-200 dark:border-[#1e3a5f] bg-white dark:bg-[#0f1a2e]/50"
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest dark:text-white">
                          {key === "id" ? "ID Card / License" : key.toUpperCase()}
                        </span>
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                            newCandidate.documents![key] === "COMPLETE"
                              ? "bg-gold text-enterprise-blue shadow-lg"
                              : "bg-slate-200 dark:bg-[#132445]"
                          }`}
                        >
                          <i
                            className={`fas fa-check text-[10px] ${
                              newCandidate.documents![key] === "COMPLETE"
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          ></i>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Supplemental Upload */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => supplementalRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl dark:text-white hover:border-gold transition-colors flex items-center justify-center gap-2"
                >
                  <i className="fas fa-cloud-upload-alt"></i> Upload Supplemental Documents
                </button>
                <input
                  type="file"
                  multiple
                  ref={supplementalRef}
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from((e.target.files || []) as FileList) as File[];
                    if (!files.length) return;
                    const mappedFiles = await Promise.all(
                      files.map(async (file): Promise<UploadedSupplementalDocument> => ({
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        name: file.name,
                        mimeType: file.type || "application/octet-stream",
                        size: file.size,
                        uploadedAt: new Date().toISOString(),
                        dataUrl: await readFileAsDataUrl(file),
                      }))
                    );
                    setNewCandidate((prev) => {
                      const existing = getSupplementalFiles(prev);
                      const supplementalFiles = [...existing, ...mappedFiles];
                      return {
                        ...prev,
                        documents: {
                          ...prev.documents!,
                          supplemental: supplementalFiles.length ? "COMPLETE" : "NONE",
                          supplementalFiles,
                        },
                      };
                    });
                    e.currentTarget.value = "";
                  }}
                />
                {getSupplementalFiles(newCandidate).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {getSupplementalFiles(newCandidate).map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#1e3a5f] bg-slate-50 dark:bg-[#0a1628] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold dark:text-white truncate">{doc.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {(doc.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setNewCandidate((prev) => {
                              const filtered = getSupplementalFiles(prev).filter((file) => file.id !== doc.id);
                              return {
                                ...prev,
                                documents: {
                                  ...prev.documents!,
                                  supplemental: filtered.length ? "COMPLETE" : "NONE",
                                  supplementalFiles: filtered,
                                },
                              };
                            })
                          }
                          className="text-red-500 hover:text-red-600 text-xs font-black uppercase"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-5 bg-gold text-enterprise-blue rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-gold/20 active:scale-95 transition-all"
              >
                {editingCandidate ? "Update Candidate" : "Register Candidate"}
              </button>
            </form>
          </div>
        </div>
      )}
      {isProfileOpen && selectedCandidate && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm"
          onClick={() => setIsProfileOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#0f1a2e] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar border dark:border-[#1e3a5f] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div ref={profileRef} className="p-8 space-y-8 print:text-[#003366]">
              {/* Header with Image and Basic Info */}
              <div className="flex flex-col md:flex-row gap-8 items-start border-b dark:border-[#1e3a5f] pb-8">
                <img
                  src={selectedCandidate.photoUrl || fallbackImage(selectedCandidate.fullName)}
                  alt={selectedCandidate.fullName}
                  className="w-32 h-32 rounded-2xl object-cover border-4 border-gold shadow-lg"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = fallbackImage(selectedCandidate.fullName);
                  }}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl font-black dark:text-white uppercase tracking-tight">
                        {selectedCandidate.fullName}
                      </h2>
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
                        {selectedCandidate.occupation} • {selectedCandidate.experienceYears} Years Exp.
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${getStatusColor(selectedCandidate.status)}`}>
                        {selectedCandidate.status}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-[#132445] text-[9px] font-black uppercase tracking-widest text-slate-500">
                        Docs: {Object.values(getDocumentStatuses(selectedCandidate.documents)).filter(s => s === 'COMPLETE').length} / 5
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                    <div className="p-3 bg-slate-50 dark:bg-[#0a1628] rounded-xl border dark:border-[#1e3a5f]">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Reference ID</p>
                      <p className="text-xs font-bold dark:text-white font-mono">{selectedCandidate.id}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-[#0a1628] rounded-xl border dark:border-[#1e3a5f]">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Email</p>
                      <p className="text-xs font-bold dark:text-white truncate">{selectedCandidate.email}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-[#0a1628] rounded-xl border dark:border-[#1e3a5f]">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Phone</p>
                      <p className="text-xs font-bold dark:text-white">{selectedCandidate.phone}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-[#0a1628] rounded-xl border dark:border-[#1e3a5f]">
                      <p className="text-[9px] font-black text-slate-400 uppercase">DOB / Age</p>
                      <p className="text-xs font-bold dark:text-white">{selectedCandidate.dob} ({selectedCandidate.age})</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-[#0a1628] rounded-xl border dark:border-[#1e3a5f]">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Address</p>
                      <p className="text-xs font-bold dark:text-white truncate">{selectedCandidate.address}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-[#0a1628] rounded-xl border dark:border-[#1e3a5f]">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Position Applied</p>
                      <p className="text-xs font-bold dark:text-white">{selectedCandidate.positionApplied}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Skills & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b dark:border-[#1e3a5f] pb-8">
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest">
                    Professional Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.skills && selectedCandidate.skills.length > 0 ? (
                      selectedCandidate.skills.map((skill, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-[#132445] text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No skills listed.</span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest">
                    Candidate Notes
                  </h4>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-xl">
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      Candidate shows strong potential for leadership roles. Verified previous employment at logistics firm. Pending final background check clearance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Document Status with Color Grading */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest">
                  Documentation Compliance
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(getDocumentStatuses(selectedCandidate.documents)).map(([doc, status]) => (
                    <div key={doc} className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 ${
                      status === 'COMPLETE' 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50' 
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm ${
                        status === 'COMPLETE' ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        <i className={`fas ${status === 'COMPLETE' ? 'fa-check' : 'fa-times'}`}></i>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                        {formatDocumentLabel(doc)}
                      </span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                        status === 'COMPLETE' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                      }`}>
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest">
                  Supplemental Documents
                </h4>
                {getSupplementalFiles(selectedCandidate).length > 0 ? (
                  <div className="space-y-3" data-supplemental="true">
                    {getSupplementalFiles(selectedCandidate).map((doc) => (
                      <div key={doc.id} className="rounded-xl border border-slate-200 dark:border-[#1e3a5f] p-4 bg-slate-50 dark:bg-[#0a1628]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black dark:text-white truncate">{doc.name}</p>
                            <p className="text-xs text-slate-500">
                              {doc.mimeType || "Unknown"} | {(doc.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={doc.dataUrl}
                              download={doc.name}
                              className="px-3 py-2 text-[10px] font-black uppercase rounded-lg bg-slate-200 dark:bg-[#132445] text-slate-700 dark:text-white"
                            >
                              Download
                            </a>
                            {canInlinePreview(doc) && (
                              <button
                                type="button"
                                onClick={() => setSupplementalPreview(doc)}
                                className="px-3 py-2 text-[10px] font-black uppercase rounded-lg bg-enterprise-blue text-white"
                              >
                                Preview
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic text-slate-400">No supplemental documents uploaded.</p>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-6 bg-slate-50 dark:bg-[#0f1a2e]/50 border-t dark:border-[#1e3a5f] flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => handlePDFDownload(false)}
                className="px-6 py-3 bg-slate-200 dark:bg-[#132445] text-slate-700 dark:text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-300 dark:hover:bg-[#1d325b] transition-colors flex items-center gap-2"
              >
                <i className="fas fa-file-pdf"></i> Export Profile PDF
              </button>
              <button
                onClick={() => handlePDFDownload(true)}
                className="px-6 py-3 bg-slate-200 dark:bg-[#132445] text-slate-700 dark:text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-300 dark:hover:bg-[#1d325b] transition-colors flex items-center gap-2"
              >
                <i className="fas fa-file-export"></i> Export + Docs
              </button>
              <button
                onClick={() => handlePrint(false)}
                className="px-6 py-3 bg-slate-200 dark:bg-[#132445] text-slate-700 dark:text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-300 dark:hover:bg-[#1d325b] transition-colors flex items-center gap-2"
              >
                <i className="fas fa-print"></i> Print Profile
              </button>
              <button
                onClick={() => handlePrint(true)}
                className="px-6 py-3 bg-slate-200 dark:bg-[#132445] text-slate-700 dark:text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-300 dark:hover:bg-[#1d325b] transition-colors flex items-center gap-2"
              >
                <i className="fas fa-print"></i> Print + Docs
              </button>
              <button
                onClick={() => setIsProfileOpen(false)}
                className="px-6 py-3 bg-gold text-enterprise-blue rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-gold/20 hover:brightness-110 transition-all"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
      {supplementalPreview && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSupplementalPreview(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] overflow-auto bg-white dark:bg-[#0f1a2e] rounded-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black dark:text-white truncate">{supplementalPreview.name}</h3>
              <button
                type="button"
                className="text-slate-500 hover:text-red-500"
                onClick={() => setSupplementalPreview(null)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            {supplementalPreview.mimeType.startsWith("image/") ? (
              <img src={supplementalPreview.dataUrl} alt={supplementalPreview.name} className="max-w-full h-auto rounded-lg" />
            ) : (
              <iframe
                title={supplementalPreview.name}
                src={supplementalPreview.dataUrl}
                className="w-full h-[75vh] rounded-lg border border-slate-200 dark:border-[#1e3a5f]"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );

  const normalizeHeaderKey = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

  const normalizeStatus = (value?: string): Candidate["status"] => {
    const v = (value || "").toUpperCase();
    if (v.includes("INTERVIEW")) return RecruitmentStatus.INTERVIEW;
    if (v.includes("TRAIN")) return RecruitmentStatus.TRAINING;
    if (v.includes("DEPLOY")) return RecruitmentStatus.DEPLOYMENT;
    return RecruitmentStatus.PENDING;
  };

  const parseDocumentState = (value?: string): DocumentStatus[keyof DocumentStatus] => {
    const v = (value || "").toUpperCase();
    if (v.includes("COMPLETE") || v === "YES" || v === "TRUE" || v === "1") return "COMPLETE";
    if (v.includes("INCOMPLETE")) return "INCOMPLETE";
    return "NONE";
  };

  const parseSkillList = (value?: string): string[] =>
    (value || "")
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const computeAgeFromDob = (dob: string) => {
    const birth = new Date(`${dob}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return 30;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
    return Math.max(18, age);
  };

  const importRecords = (rows: Record<string, unknown>[]) => {
    const now = new Date().toISOString();
    const created: Candidate[] = [];
    rows.forEach((row, idx) => {
      const normalized = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[normalizeHeaderKey(String(key))] = value == null ? "" : String(value).trim();
        return acc;
      }, {});
      const fullName = normalized.fullname || normalized.name || normalized.candidatename;
      if (!fullName) return;
      const dob = normalized.dob || normalized.dateofbirth || "1990-01-01";
      const email = normalized.email || `${fullName.toLowerCase().replace(/\s+/g, ".")}@example.com`;
      const phone = normalized.phone || normalized.phonenumber || "";
      const id = normalized.id || normalized.reference || `ZGL-IMP-${Date.now()}-${idx + 1}`;
      const documents: DocumentStatus = {
        cv: parseDocumentState(normalized.cv),
        id: parseDocumentState(normalized.idcard || normalized.iddocument || normalized.identity),
        certificates: parseDocumentState(normalized.certificates),
        tin: parseDocumentState(normalized.tin),
        supplemental: "NONE",
        supplementalFiles: [],
      };
      created.push({
        id,
        fullName,
        gender: (normalized.gender || "M").toUpperCase().startsWith("F") ? "F" : "M",
        phone,
        email,
        dob,
        age: Number(normalized.age) > 0 ? Number(normalized.age) : computeAgeFromDob(dob),
        address: normalized.address || "Registered Office",
        occupation: normalized.occupation || "Candidate",
        experienceYears: Number(normalized.experienceyears || normalized.experience || 0) || 0,
        positionApplied: normalized.positionapplied || normalized.position || "General Application",
        status: normalizeStatus(normalized.status),
        documents,
        skills: parseSkillList(normalized.skills),
        createdAt: now,
        photoUrl: fallbackImage(fullName),
      });
    });
    return created;
  };

  const handleImportSheet = async (file: File) => {
    setIsImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        alert("No worksheet found in file.");
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const imported = importRecords(rows);
      if (imported.length === 0) {
        alert("No valid candidate rows were found. Ensure file includes at least a Name/FullName column.");
        return;
      }
      imported.forEach((candidate) => onAdd(candidate));
      alert(`Import complete. Added ${imported.length} candidate(s).`);
    } catch {
      alert("Unable to import file. Please check CSV/Excel format and try again.");
    } finally {
      setIsImporting(false);
    }
  };
};

export default CandidateRegistry;

