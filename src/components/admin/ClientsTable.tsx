"use client";

import React, { useState, useEffect } from "react";
import { Building2, Mail, Calendar, FolderKanban, Search, Phone, MapPin, Globe, ChevronDown, ChevronUp, Plus, Edit, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import CreateClientModal from "./CreateClientModal";
import EditClientModal from "./EditClientModal";

interface ClientProject {
  _id: string;
  projectName: string;
  description: string;
  status: string;
  priority: string;
  deadline: string | null;
  startDate: string | null;
  budget: number | string;
  createdAt: string | null;
}

interface Client {
  _id: string;
  name: string;
  email: string;
  createdAt: string | null;
  companyName?: string;
  contactPersonName?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  projects: ClientProject[];
  projectCount: number;
  totalInvestment: number;
}

export default function ClientsTable() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/clients-with-projects");
      const data = await response.json();
      if (response.ok) {
        setClients(data.clients || []);
      } else {
        console.error("Error fetching clients:", data.error);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleClient = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const handleEditClient = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setClientToEdit(client);
    setShowEditModal(true);
  };

  const handleDeleteClient = async (e: React.MouseEvent, clientId: string, clientName: string) => {
    e.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete client "${clientName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/delete-client?clientId=${clientId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        alert('Client deleted successfully');
        fetchClients();
      } else {
        alert(data.error || 'Failed to delete client');
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('An error occurred while deleting client');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "pending_assignment":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number | string) => {
    if (!amount) return "₹0.00";
    const numAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, '')) || 0 : amount;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numAmount);
  };

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.companyName && client.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      client.projects.some((p) =>
        p.projectName.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Create Button */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search clients, companies, or projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Client
        </button>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-neutral-50 border-b-2 border-neutral-300">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider border-r border-neutral-200">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider border-r border-neutral-200">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider border-r border-neutral-200">
                  Projects
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider border-r border-neutral-200">
                  Total Investment
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                    No clients found
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <React.Fragment key={client._id}>
                    <tr
                      className="hover:bg-neutral-50 transition-colors cursor-pointer border-b border-neutral-200"
                      onClick={() => toggleClient(client._id)}
                    >
                      <td className="px-4 py-3 border-r border-neutral-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-neutral-900">{client.name}</div>
                            {client.companyName && (
                              <div className="text-xs text-neutral-500">{client.companyName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r border-neutral-200">
                        <div className="flex items-center gap-2 text-neutral-600">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">{client.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r border-neutral-200">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold text-neutral-900">
                            {client.projectCount}
                          </span>
                          <span className="text-sm text-neutral-500">projects</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r border-neutral-200">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-700">
                            {formatCurrency(client.totalInvestment)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleEditClient(e, client)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Client"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClient(e, client._id, client.name)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Client"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleClient(client._id)}
                            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium ml-2"
                          >
                            {expandedClients.has(client._id) ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Hide
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                View
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedClients.has(client._id) && (
                      <tr>
                        <td colSpan={5} className="px-6 py-6 bg-neutral-50 border-b-2 border-neutral-300">
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-6"
                          >
                            {/* Client Information Table */}
                            <div className="bg-white rounded-lg border-2 border-neutral-300 overflow-hidden">
                              <div className="bg-emerald-600 px-4 py-3 border-b-2 border-emerald-700">
                                <h4 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                                  <Building2 className="w-4 h-4" />
                                  Client Information
                                </h4>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                  <tbody>
                                    <tr className="border-b border-neutral-200">
                                      <td className="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50 border-r border-neutral-200 w-1/4">
                                        Contact Person
                                      </td>
                                      <td className="px-4 py-3 text-neutral-900">{client.contactPersonName || client.name}</td>
                                    </tr>
                                    <tr className="border-b border-neutral-200">
                                      <td className="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50 border-r border-neutral-200">
                                        Company Name
                                      </td>
                                      <td className="px-4 py-3 text-neutral-900">{client.companyName || "N/A"}</td>
                                    </tr>
                                    <tr className="border-b border-neutral-200">
                                      <td className="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50 border-r border-neutral-200">
                                        Email
                                      </td>
                                      <td className="px-4 py-3 text-neutral-900 flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-neutral-500" />
                                        {client.email}
                                      </td>
                                    </tr>
                                    <tr className="border-b border-neutral-200">
                                      <td className="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50 border-r border-neutral-200">
                                        Phone
                                      </td>
                                      <td className="px-4 py-3 text-neutral-900 flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-neutral-500" />
                                        {client.phone || "N/A"}
                                      </td>
                                    </tr>
                                    {client.alternatePhone && (
                                      <tr className="border-b border-neutral-200">
                                        <td className="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50 border-r border-neutral-200">
                                          Alternate Phone
                                        </td>
                                        <td className="px-4 py-3 text-neutral-900 flex items-center gap-2">
                                          <Phone className="w-4 h-4 text-neutral-500" />
                                          {client.alternatePhone}
                                        </td>
                                      </tr>
                                    )}
                                    <tr className="border-b border-neutral-200">
                                      <td className="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50 border-r border-neutral-200">
                                        Address
                                      </td>
                                      <td className="px-4 py-3 text-neutral-900 flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-neutral-500" />
                                        {client.address || "N/A"}
                                        {client.city && `, ${client.city}`}
                                        {client.state && `, ${client.state}`}
                                        {client.pincode && ` ${client.pincode}`}
                                      </td>
                                    </tr>
                                    {client.website && (
                                      <tr className="border-b border-neutral-200">
                                        <td className="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50 border-r border-neutral-200">
                                          Website
                                        </td>
                                        <td className="px-4 py-3 text-neutral-900 flex items-center gap-2">
                                          <Globe className="w-4 h-4 text-neutral-500" />
                                          <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                                            {client.website}
                                          </a>
                                        </td>
                                      </tr>
                                    )}
                                    {client.industry && (
                                      <tr className="border-b border-neutral-200">
                                        <td className="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50 border-r border-neutral-200">
                                          Industry
                                        </td>
                                        <td className="px-4 py-3 text-neutral-900">{client.industry}</td>
                                      </tr>
                                    )}
                                    {client.companySize && (
                                      <tr>
                                        <td className="px-4 py-3 font-semibold text-neutral-700 bg-neutral-50 border-r border-neutral-200">
                                          Company Size
                                        </td>
                                        <td className="px-4 py-3 text-neutral-900">{client.companySize}</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Projects Table */}
                            {client.projects.length > 0 && (
                              <div className="bg-white rounded-lg border-2 border-neutral-300 overflow-hidden">
                                <div className="bg-emerald-600 px-4 py-3 border-b-2 border-emerald-700">
                                  <h4 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                                    <FolderKanban className="w-4 h-4" />
                                    Projects ({client.projects.length}) - Total Investment: {formatCurrency(client.totalInvestment)}
                                  </h4>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead className="bg-neutral-100 border-b-2 border-neutral-300">
                                      <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider border-r border-neutral-200">
                                          Project Name
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider border-r border-neutral-200">
                                          Description
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider border-r border-neutral-200">
                                          Status
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider border-r border-neutral-200">
                                          Priority
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider border-r border-neutral-200">
                                          Budget
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider border-r border-neutral-200">
                                          Start Date
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-neutral-700 uppercase tracking-wider">
                                          Deadline
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200">
                                      {client.projects.map((project) => (
                                        <tr key={project._id} className="hover:bg-neutral-50 border-b border-neutral-200">
                                          <td className="px-4 py-3 border-r border-neutral-200 font-medium text-neutral-900">
                                            {project.projectName}
                                          </td>
                                          <td className="px-4 py-3 border-r border-neutral-200 text-sm text-neutral-600 max-w-xs truncate">
                                            {project.description || "N/A"}
                                          </td>
                                          <td className="px-4 py-3 border-r border-neutral-200">
                                            <span
                                              className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                                                project.status
                                              )}`}
                                            >
                                              {project.status}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 border-r border-neutral-200">
                                            <span
                                              className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                                                project.priority
                                              )}`}
                                            >
                                              {project.priority}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 border-r border-neutral-200 font-semibold text-emerald-700">
                                            {formatCurrency(project.budget)}
                                          </td>
                                          <td className="px-4 py-3 border-r border-neutral-200 text-sm text-neutral-600">
                                            {formatDate(project.startDate)}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-neutral-600">
                                            {formatDate(project.deadline)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Client Modal */}
      {showCreateModal && (
        <CreateClientModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchClients}
        />
      )}

      {/* Edit Client Modal */}
      {showEditModal && clientToEdit && (
        <EditClientModal
          client={clientToEdit}
          onClose={() => {
            setShowEditModal(false);
            setClientToEdit(null);
          }}
          onSuccess={fetchClients}
        />
      )}
    </div>
  );
}
