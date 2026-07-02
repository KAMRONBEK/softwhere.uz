'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { adminFetch } from '@/modules/admin/utils/adminFetch';
import { AdminLoading } from '@/modules/admin/components';

interface Lead {
  id: string;
  name: string;
  phone: string;
  message: string | null;
  source: string | null;
  notifiedTelegram: 'pending' | 'sent' | 'failed';
  createdAt: string;
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/leads');
        if (res.ok) {
          const data = await res.json();
          setLeads(data.leads || []);
        }
      } catch {
        /* handled by adminFetch (401 reloads); other errors leave the empty state */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className='min-h-screen bg-ember-surface2 flex items-center justify-center'>
        <AdminLoading message='Loading leads...' />
      </div>
    );
  }

  return (
    <div className='page-layout min-h-screen bg-ember-surface2'>
      <div className='bg-ember-surface border-b border-ember-border'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
          <h1 className='text-3xl font-bold text-ember-text font-display'>Leads</h1>
          <p className='mt-1 text-sm text-ember-muted'>{leads.length} contact-form submission(s)</p>
        </div>
      </div>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {leads.length === 0 ? (
          <div className='py-16 text-center text-ember-muted'>No leads yet.</div>
        ) : (
          <div className='bg-ember-surface rounded-xl border border-ember-border overflow-hidden'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead className='bg-ember-surface2 text-ember-muted'>
                  <tr>
                    <th className='text-left font-medium px-4 py-3 whitespace-nowrap'>Date</th>
                    <th className='text-left font-medium px-4 py-3'>Name</th>
                    <th className='text-left font-medium px-4 py-3'>Phone</th>
                    <th className='text-left font-medium px-4 py-3'>Message</th>
                    <th className='text-left font-medium px-4 py-3'>Source</th>
                    <th className='text-left font-medium px-4 py-3'>Notified</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-ember-border'>
                  {leads.map(lead => (
                    <tr key={lead.id} className='text-ember-text align-top'>
                      <td className='px-4 py-3 whitespace-nowrap text-ember-muted'>{format(new Date(lead.createdAt), 'MMM dd, HH:mm')}</td>
                      <td className='px-4 py-3 whitespace-nowrap'>{lead.name}</td>
                      <td className='px-4 py-3 whitespace-nowrap'>
                        <a href={`tel:${lead.phone}`} className='hover:text-ember-accent'>{lead.phone}</a>
                      </td>
                      <td className='px-4 py-3 max-w-md whitespace-pre-wrap'>
                        {lead.message || <span className='text-ember-muted'>—</span>}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-ember-muted'>{lead.source || '—'}</td>
                      <td className='px-4 py-3 whitespace-nowrap'>
                        <span
                          className={
                            lead.notifiedTelegram === 'sent'
                              ? 'text-green-400'
                              : lead.notifiedTelegram === 'failed'
                                ? 'text-red-400'
                                : 'text-ember-muted'
                          }
                        >
                          {lead.notifiedTelegram}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
