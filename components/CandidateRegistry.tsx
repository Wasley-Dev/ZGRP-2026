import React, { useState, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { Candidate, RecruitmentStatus, DocumentStatus } from "../types";

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
  const supplementalRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
      documents: newCandidate.documents as DocumentStatus,
      skills: newCandidate.skills || [],
      createdAt: new Date().toISOString(),
      photoUrl: previewImage || `https://picsum.photos/seed/${newCandidate.fullName}/200/200`
    };

    if (editingCandidate) {
      onUpdate(candidate);
    } else {
      onAdd(candidate);
    }

    setIsFormOpen(false);
    setEditingCandidate(null);
    setPreviewImage(null);
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

  const handlePDFDownload = async () => {
    if (!profileRef.current) return;
    
    // Temporarily force light mode styles for capture
    const originalClass = profileRef.current.className;
    profileRef.current.classList.add('bg-white', 'text-slate-900');
    profileRef.current.classList.remove('dark:bg-slate-900', 'dark:text-white');
    
    const canvas = await html2canvas(profileRef.current, {
      backgroundColor: '#ffffff',
      scale: 2
    });
    
    // Restore styles
    profileRef.current.className = originalClass;

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${selectedCandidate?.fullName}_Dossier.pdf`);
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
      const completedDocs = Object.values(candidate.documents).filter(d => d === 'COMPLETE').length;
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

  const toggleDoc = (key: keyof DocumentStatus) => {
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
    <div className="space-y-4 text-slate-900 dark:text-white print:text-black">

      {/* HEADER */}
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border dark:border-slate-800 shadow-sm print:hidden">
        <div className="flex justify-between items-center">
           <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Candidate Registry</h2>
           <div className="flex gap-2">
            {mode === "database" && (
              <button
                onClick={handleBulkDownload}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-900/20 hover:brightness-110 transition-all"
              >
                <i className="fas fa-download mr-2"></i> Download Database
              </button>
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
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-gold/20"
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
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-slate-100 dark:bg-slate-800">
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
              <tr key={c.id} className="border-b dark:border-slate-800">
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
                  {Object.entries(c.documents).map(([doc, status]) => (
                    <span
                      key={doc}
                      className={`px-2 py-1 text-[9px] font-black rounded-full ${
                        status === "COMPLETE"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {doc.toUpperCase()}
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
                        documents: c.documents,
                      });
                      setPreviewImage(c.photoUrl || null);
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
            className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar border dark:border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
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
                    <div className="w-32 h-32 rounded-[2rem] bg-slate-100 dark:bg-slate-800 border-4 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:border-gold hover:text-gold transition-all">
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
                <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest border-b dark:border-slate-800 pb-2">
                  Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Full Name
                    </label>
                    <input
                      required
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest border-b dark:border-slate-800 pb-2">
                  Professional Experience & Skills
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-1">
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">
                      Occupation
                    </label>
                    <input
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                      className="w-full p-4 rounded-2xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-2 focus:ring-gold/20"
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
                <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest border-b dark:border-slate-800 pb-2">
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
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50"
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest dark:text-white">
                          {key === "id" ? "ID Card / License" : key.toUpperCase()}
                        </span>
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                            newCandidate.documents![key] === "COMPLETE"
                              ? "bg-gold text-enterprise-blue shadow-lg"
                              : "bg-slate-200 dark:bg-slate-800"
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
                  onChange={(e) => {
                    if (e.target.files) {
                      setNewCandidate((prev) => ({
                        ...prev,
                        documents: {
                          ...prev.documents!,
                          supplemental: "COMPLETE",
                        },
                      }));
                      alert(`${e.target.files.length} files selected.`);
                    }
                  }}
                />
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
            className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar border dark:border-slate-800 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div ref={profileRef} className="p-8 space-y-8">
              {/* Header with Image and Basic Info */}
              <div className="flex flex-col md:flex-row gap-8 items-start border-b dark:border-slate-800 pb-8">
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
                      <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500">
                        Docs: {Object.values(selectedCandidate.documents).filter(s => s === 'COMPLETE').length} / 5
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Reference ID</p>
                      <p className="text-xs font-bold dark:text-white font-mono">{selectedCandidate.id}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Email</p>
                      <p className="text-xs font-bold dark:text-white truncate">{selectedCandidate.email}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Phone</p>
                      <p className="text-xs font-bold dark:text-white">{selectedCandidate.phone}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase">DOB / Age</p>
                      <p className="text-xs font-bold dark:text-white">{selectedCandidate.dob} ({selectedCandidate.age})</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Address</p>
                      <p className="text-xs font-bold dark:text-white truncate">{selectedCandidate.address}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Position Applied</p>
                      <p className="text-xs font-bold dark:text-white">{selectedCandidate.positionApplied}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Skills & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b dark:border-slate-800 pb-8">
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest">
                    Professional Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.skills && selectedCandidate.skills.length > 0 ? (
                      selectedCandidate.skills.map((skill, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase">
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
                  {Object.entries(selectedCandidate.documents).map(([doc, status]) => (
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
                        {doc}
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
            </div>

            {/* Actions Footer */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-800 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={handlePDFDownload}
                className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <i className="fas fa-file-pdf"></i> Export PDF
              </button>
              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <i className="fas fa-print"></i> Print Dossier
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
    </div>
  );
};

export default CandidateRegistry;
