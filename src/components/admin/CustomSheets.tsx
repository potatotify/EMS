"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  FileSpreadsheet, 
  Plus, 
  Edit2, 
  Trash2, 
  Download,
  Search,
  RefreshCw,
  X,
  Save,
  Eye
} from "lucide-react";

interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  required?: boolean;
}

interface CustomSheet {
  _id: string;
  name: string;
  description?: string;
  columns: Column[];
  dataSource: {
    type: 'api' | 'static' | 'query';
    endpoint?: string;
    query?: string;
    data?: any[];
  };
  createdBy?: {
    name: string;
    email: string;
  };
  createdAt: string;
  data?: any[];
}

export default function CustomSheets() {
  const [sheets, setSheets] = useState<CustomSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<CustomSheet | null>(null);
  const [viewingSheet, setViewingSheet] = useState<string | null>(null);
  const [viewingData, setViewingData] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    columns: [] as Column[],
    dataSource: {
      type: 'static' as 'api' | 'static' | 'query',
      endpoint: "",
      query: "",
      data: [] as any[]
    }
  });

  useEffect(() => {
    fetchSheets();
  }, []);

  const fetchSheets = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/custom-sheets");
      const data = await response.json();
      if (response.ok) {
        console.log("Fetched sheets:", data.sheets);
        setSheets(data.sheets || []);
      } else {
        console.error("Error fetching sheets:", data.error || data.details || "Unknown error");
        alert("Error fetching sheets: " + (data.error || data.details || "Unknown error"));
      }
    } catch (error) {
      console.error("Error fetching sheets:", error);
      alert("Failed to fetch sheets. Please check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSheetData = async (sheetId: string) => {
    try {
      const response = await fetch(`/api/admin/custom-sheets/${sheetId}`);
      const data = await response.json();
      if (response.ok) {
        console.log("Fetched sheet data:", data.sheet);
        // Get data from sheet.data (returned by API) or fallback to dataSource.data
        const sheetData = data.sheet.data || data.sheet.dataSource?.data || [];
        console.log("Setting viewing data:", sheetData);
        setViewingData(sheetData);
      } else {
        console.error("Error fetching sheet data:", data.error || data.details);
      }
    } catch (error) {
      console.error("Error fetching sheet data:", error);
    }
  };

  const handleCreateSheet = async () => {
    try {
      const response = await fetch("/api/admin/custom-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (response.ok) {
        await fetchSheets();
        setShowCreateModal(false);
        resetForm();
        alert("Sheet created successfully!");
      } else {
        alert("Error: " + (data.error || "Failed to create sheet"));
      }
    } catch (error) {
      console.error("Error creating sheet:", error);
      alert("Failed to create sheet");
    }
  };

  const handleUpdateSheet = async () => {
    if (!selectedSheet) return;

    try {
      const response = await fetch(`/api/admin/custom-sheets/${selectedSheet._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (response.ok) {
        await fetchSheets();
        setShowEditModal(false);
        setSelectedSheet(null);
        resetForm();
        alert("Sheet updated successfully!");
      } else {
        alert("Error: " + (data.error || "Failed to update sheet"));
      }
    } catch (error) {
      console.error("Error updating sheet:", error);
      alert("Failed to update sheet");
    }
  };

  const handleDeleteSheet = async (sheetId: string) => {
    if (!confirm("Are you sure you want to delete this sheet?")) return;

    try {
      const response = await fetch(`/api/admin/custom-sheets/${sheetId}`, {
        method: "DELETE"
      });

      const data = await response.json();
      if (response.ok) {
        await fetchSheets();
        alert("Sheet deleted successfully!");
      } else {
        alert("Error: " + (data.error || "Failed to delete sheet"));
      }
    } catch (error) {
      console.error("Error deleting sheet:", error);
      alert("Failed to delete sheet");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      columns: [],
      dataSource: {
        type: 'static',
        endpoint: "",
        query: "",
        data: []
      }
    });
  };

  const addColumn = () => {
    setFormData({
      ...formData,
      columns: [
        ...formData.columns,
        {
          key: `column_${formData.columns.length + 1}`,
          label: "",
          type: 'text',
          required: false
        }
      ]
    });
  };

  const updateColumn = (index: number, field: keyof Column, value: any) => {
    const newColumns = [...formData.columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setFormData({ ...formData, columns: newColumns });
  };

  const removeColumn = (index: number) => {
    setFormData({
      ...formData,
      columns: formData.columns.filter((_, i) => i !== index)
    });
  };

  const addRow = () => {
    const newRow: any = {};
    formData.columns.forEach(col => {
      newRow[col.key] = col.type === 'boolean' ? false : col.type === 'number' ? 0 : "";
    });
    setFormData({
      ...formData,
      dataSource: {
        ...formData.dataSource,
        data: [...(formData.dataSource.data || []), newRow]
      }
    });
  };

  const updateRow = (rowIndex: number, columnKey: string, value: any) => {
    const newData = [...(formData.dataSource.data || [])];
    newData[rowIndex] = { ...newData[rowIndex], [columnKey]: value };
    setFormData({
      ...formData,
      dataSource: {
        ...formData.dataSource,
        data: newData
      }
    });
  };

  const removeRow = (rowIndex: number) => {
    setFormData({
      ...formData,
      dataSource: {
        ...formData.dataSource,
        data: (formData.dataSource.data || []).filter((_, i) => i !== rowIndex)
      }
    });
  };

  const exportToCSV = (sheet: CustomSheet) => {
    if (!sheet.columns || sheet.columns.length === 0) return;

    const headers = sheet.columns.map(col => col.label);
    const rows = (viewingData.length > 0 ? viewingData : sheet.dataSource.data || []).map((row: any) =>
      sheet.columns.map(col => row[col.key] || "")
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.name}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const openEditModal = (sheet: CustomSheet) => {
    setSelectedSheet(sheet);
    setFormData({
      name: sheet.name,
      description: sheet.description || "",
      columns: sheet.columns,
      dataSource: {
        type: sheet.dataSource.type,
        endpoint: sheet.dataSource.endpoint || '',
        query: sheet.dataSource.query || '',
        data: sheet.dataSource.data || []
      }
    });
    setShowEditModal(true);
  };

  const openViewModal = async (sheet: CustomSheet) => {
    setViewingSheet(sheet._id);
    // First set data from the sheet object if available (for static data)
    if (sheet.dataSource?.type === 'static' && sheet.dataSource?.data) {
      setViewingData(sheet.dataSource.data);
    }
    // Then fetch fresh data from API
    await fetchSheetData(sheet._id);
  };

  const filteredSheets = sheets.filter((sheet) =>
    sheet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sheet.description && sheet.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search sheets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Sheet
        </motion.button>
      </div>

      {/* Sheets Grid */}
      {filteredSheets.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-300 rounded-2xl">
          <FileSpreadsheet className="w-20 h-20 text-neutral-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-neutral-600 mb-2">
            {searchTerm ? "No sheets found" : "No custom sheets yet"}
          </p>
          <p className="text-neutral-500">
            {searchTerm ? "Try a different search term" : "Create your first custom sheet to get started"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSheets.map((sheet) => (
            <motion.div
              key={sheet._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-1">{sheet.name}</h3>
                  {sheet.description && (
                    <p className="text-sm text-neutral-600">{sheet.description}</p>
                  )}
                </div>
                <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="space-y-2 mb-4">
                <p className="text-sm text-neutral-600">
                  <span className="font-medium">Columns:</span> {sheet.columns.length}
                </p>
                <p className="text-sm text-neutral-600">
                  <span className="font-medium">Data Source:</span> {sheet.dataSource.type}
                </p>
                {sheet.createdBy && (
                  <p className="text-sm text-neutral-600">
                    <span className="font-medium">Created by:</span> {sheet.createdBy.name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openViewModal(sheet)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => openEditModal(sheet)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteSheet(sheet._id)}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {showCreateModal ? "Create Custom Sheet" : "Edit Custom Sheet"}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedSheet(null);
                  resetForm();
                }}
                className="text-white hover:text-neutral-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Sheet Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter sheet name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  rows={2}
                  placeholder="Enter description (optional)"
                />
              </div>

              {/* Columns Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-neutral-700">
                    Columns *
                  </label>
                  <button
                    onClick={addColumn}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Column
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.columns.map((column, index) => (
                    <div key={index} className="border border-neutral-200 rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">
                            Column Label *
                          </label>
                          <input
                            type="text"
                            value={column.label}
                            onChange={(e) => updateColumn(index, 'label', e.target.value)}
                            className="w-full px-3 py-1.5 border border-neutral-300 rounded text-sm"
                            placeholder="Column name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">
                            Type *
                          </label>
                          <select
                            value={column.type}
                            onChange={(e) => updateColumn(index, 'type', e.target.value)}
                            className="w-full px-3 py-1.5 border border-neutral-300 rounded text-sm"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="boolean">Boolean</option>
                            <option value="select">Select</option>
                          </select>
                        </div>
                      </div>
                      {column.type === 'select' && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">
                            Options (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={column.options?.join(", ") || ""}
                            onChange={(e) => updateColumn(index, 'options', e.target.value.split(",").map(s => s.trim()))}
                            className="w-full px-3 py-1.5 border border-neutral-300 rounded text-sm"
                            placeholder="Option 1, Option 2, Option 3"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-neutral-600">
                          <input
                            type="checkbox"
                            checked={column.required || false}
                            onChange={(e) => updateColumn(index, 'required', e.target.checked)}
                            className="rounded"
                          />
                          Required
                        </label>
                        <button
                          onClick={() => removeColumn(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Source Section */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Data Source Type *
                </label>
                <select
                  value={formData.dataSource.type}
                  onChange={(e) => setFormData({
                    ...formData,
                    dataSource: { ...formData.dataSource, type: e.target.value as any }
                  })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="static">Static Data</option>
                  <option value="api">API Endpoint</option>
                  <option value="query">Database Query</option>
                </select>
              </div>

              {formData.dataSource.type === 'static' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-neutral-700">
                      Data Rows
                    </label>
                    <button
                      onClick={addRow}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Row
                    </button>
                  </div>
                  {formData.columns.length > 0 && (
                    <div className="border border-neutral-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-neutral-100">
                            <tr>
                              {formData.columns.map((col, idx) => (
                                <th key={idx} className="px-3 py-2 text-left font-medium text-neutral-700 border-r border-neutral-200">
                                  {col.label}
                                </th>
                              ))}
                              <th className="px-3 py-2 text-left font-medium text-neutral-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(formData.dataSource.data || []).map((row, rowIdx) => (
                              <tr key={rowIdx} className="border-t border-neutral-200">
                                {formData.columns.map((col, colIdx) => (
                                  <td key={colIdx} className="px-3 py-2 border-r border-neutral-200">
                                    {col.type === 'boolean' ? (
                                      <input
                                        type="checkbox"
                                        checked={row[col.key] || false}
                                        onChange={(e) => updateRow(rowIdx, col.key, e.target.checked)}
                                        className="rounded"
                                      />
                                    ) : col.type === 'select' && col.options ? (
                                      <select
                                        value={row[col.key] || ""}
                                        onChange={(e) => updateRow(rowIdx, col.key, e.target.value)}
                                        className="w-full px-2 py-1 border border-neutral-300 rounded text-xs"
                                      >
                                        <option value="">Select...</option>
                                        {col.options.map((opt, optIdx) => (
                                          <option key={optIdx} value={opt}>{opt}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                                        value={row[col.key] || ""}
                                        onChange={(e) => updateRow(rowIdx, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                                        className="w-full px-2 py-1 border border-neutral-300 rounded text-xs"
                                      />
                                    )}
                                  </td>
                                ))}
                                <td className="px-3 py-2">
                                  <button
                                    onClick={() => removeRow(rowIdx)}
                                    className="text-red-600 hover:text-red-700 text-xs"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formData.dataSource.type === 'api' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    API Endpoint
                  </label>
                  <input
                    type="text"
                    value={formData.dataSource.endpoint || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      dataSource: { ...formData.dataSource, endpoint: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="/api/endpoint"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setSelectedSheet(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  onClick={showCreateModal ? handleCreateSheet : handleUpdateSheet}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <Save className="w-4 h-4" />
                  {showCreateModal ? "Create" : "Update"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* View Sheet Modal */}
      {viewingSheet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {sheets.find(s => s._id === viewingSheet)?.name}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportToCSV(sheets.find(s => s._id === viewingSheet)!)}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
                >
                  <Download className="w-4 h-4 inline mr-1" />
                  Export
                </button>
                <button
                  onClick={() => {
                    setViewingSheet(null);
                    setViewingData([]);
                  }}
                  className="text-white hover:text-neutral-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                      <tr>
                        {sheets.find(s => s._id === viewingSheet)?.columns.map((col, idx) => (
                          <th key={idx} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {(() => {
                        const currentSheet = sheets.find(s => s._id === viewingSheet);
                        // Use viewingData if available, otherwise fallback to sheet's dataSource.data
                        const displayData = viewingData.length > 0 
                          ? viewingData 
                          : (currentSheet?.dataSource?.data || []);
                        
                        if (displayData.length === 0) {
                          return (
                            <tr>
                              <td colSpan={currentSheet?.columns.length || 1} className="px-4 py-12 text-center text-neutral-500">
                                No data available
                              </td>
                            </tr>
                          );
                        }
                        
                        return displayData.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-neutral-50">
                            {currentSheet?.columns.map((col, colIdx) => (
                              <td key={colIdx} className="px-4 py-3 text-sm text-neutral-900">
                                {col.type === 'boolean' ? (row[col.key] ? 'Yes' : 'No') : String(row[col.key] || '')}
                              </td>
                            ))}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}



