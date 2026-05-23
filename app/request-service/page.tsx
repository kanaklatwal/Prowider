'use client';
// app/request-service/page.tsx
import { useState } from 'react';
import Navbar from '@/components/Navbar';

const SERVICES = [
  { id: 1, name: 'Service 1' },
  { id: 2, name: 'Service 2' },
  { id: 3, name: 'Service 3' },
];

interface FormState {
  name: string;
  phone: string;
  city: string;
  serviceId: string;
  description: string;
}

interface AssignedProvider {
  provider: { id: number; name: string };
}

interface LeadResult {
  id: number;
  name: string;
  service: { name: string };
  assignments: AssignedProvider[];
}

export default function RequestServicePage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    city: '',
    serviceId: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; lead?: LeadResult } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!form.name || !form.phone || !form.city || !form.serviceId || !form.description) {
      setResult({ success: false, message: 'All fields are required.' });
      return;
    }

    if (!/^[0-9]{10}$/.test(form.phone)) {
      setResult({ success: false, message: 'Phone must be exactly 10 digits.' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, serviceId: Number(form.serviceId) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, message: data.error || 'Something went wrong.' });
        return;
      }

      setResult({
        success: true,
        message: 'Lead submitted successfully! Providers have been assigned.',
        lead: data.lead,
      });

      setForm({ name: '', phone: '', city: '', serviceId: '', description: '' });
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Request a Service</h1>
          <p className="page-subtitle">// Fill out the form to get matched with providers</p>
        </div>

        <div className="card" style={{ maxWidth: 600 }}>
          <div className="form-grid">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="form-input"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="form-input"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="9999999999"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  className="form-input"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Mumbai"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Service Type</label>
                <select
                  className="form-select"
                  name="serviceId"
                  value={form.serviceId}
                  onChange={handleChange}
                >
                  <option value="">Select a service</option>
                  {SERVICES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe your service requirement in detail..."
              />
            </div>

            {result && (
              <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`}>
                {result.message}
                {result.success && result.lead && (
                  <div style={{ marginTop: '0.5rem' }}>
                    Assigned to:{' '}
                    {result.lead.assignments
                      .map((a: AssignedProvider) => a.provider.name)
                      .join(', ')}
                  </div>
                )}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: '100%', padding: '0.85rem' }}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
