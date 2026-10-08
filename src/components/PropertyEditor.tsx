import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { BackLink } from '@/components/ui/BackLink'
import { getErrorMessage } from '@/lib/utils'
import { readPropertyForm } from '@/lib/propertyForm'
import { listAgents } from '@/services/agents'
import {
  archiveProperty,
  deleteProperty,
  duplicateProperty,
  getStaffPropertyById,
  publishProperty,
  restoreProperty,
  updateProperty,
} from '@/services/properties'
import type { Profile, PropertyWithRelations } from '@/types/domain'
import { PropertyFields } from './property/PropertyFields'
import { ImageManager } from './property/ImageManager'
import { PropertyActivity } from './property/PropertyActivity'
import { Pill } from './crm/ui'

export function PropertyEditor({
  id,
  profile,
}: {
  id: string
  profile: Profile
}) {
  const navigate = useNavigate()
  const [property, setProperty] = useState<PropertyWithRelations | null>(null)
  const [agents, setAgents] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = () =>
    getStaffPropertyById(id)
      .then(setProperty)
      .catch((e) => setError(getErrorMessage(e)))
  useEffect(() => {
    void refresh()
    listAgents()
      .then(setAgents)
      .catch(() => setAgents([]))
  }, [id])
  if (!property)
    return (
      <>
        <BackLink fallback="/crm/properties" fallbackLabel="All properties" />
        <div className="loading">{error || 'Loading property…'}</div>
      </>
    )
  const current = property
  const perform = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await work()
      await refresh()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const fields = readPropertyForm(data)
    perform(async () => {
      await updateProperty(id, {
        ...fields,
        agent_id:
          profile.role === 'admin'
            ? String(data.get('agent_id') || '') || null
            : (current.agent_id ?? profile.id),
      })
      setNotice('Changes saved.')
    })
  }
  return (
    <>
      <BackLink fallback="/crm/properties" fallbackLabel="All properties" />
      <div className="crm-head">
        <div>
          <p className="eyebrow">
            Property workspace · <Pill value={current.status} />
          </p>
          <h1>{current.title}</h1>
        </div>
        <div className="action-row">
          {current.status === 'published' && (
            <Link to={`/properties/${current.slug}`} target="_blank">
              <Button variant="secondary">View public page</Button>
            </Link>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              // Not via perform(): its refresh of this id would race the
              // new page's load after navigating.
              setBusy(true)
              duplicateProperty(id, profile.id)
                .then((copy) => navigate(`/crm/properties/${copy.id}/edit`))
                .catch((e) => setError(getErrorMessage(e)))
                .finally(() => setBusy(false))
            }}
          >
            Duplicate
          </Button>
          {current.status === 'published' && (
            <Button
              loading={busy}
              variant="secondary"
              onClick={() => perform(() => archiveProperty(id))}
            >
              Archive
            </Button>
          )}
          {current.status === 'archived' && (
            <Button
              loading={busy}
              variant="secondary"
              onClick={() => perform(() => restoreProperty(id))}
            >
              Restore to draft
            </Button>
          )}
          {current.status !== 'published' && (
            <Button
              loading={busy}
              onClick={() => perform(() => publishProperty(id))}
            >
              Publish
            </Button>
          )}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice-inline">{notice}</p>}
      <div className="editor-layout">
        <form className="property-form" onSubmit={submit}>
          <PropertyFields
            property={current}
            agents={agents}
            profile={profile}
          />
          <div className="action-row">
            <Button type="submit" loading={busy}>
              Save changes
            </Button>
            {profile.role === 'admin' && (
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm('Permanently delete this property?'))
                    return
                  setBusy(true)
                  deleteProperty(id)
                    .then(() => navigate('/crm/properties'))
                    .catch((e) => {
                      setError(getErrorMessage(e))
                      setBusy(false)
                    })
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </form>
        <div className="editor-side">
          <ImageManager
            propertyId={id}
            title={current.title}
            images={current.property_images}
            busy={busy}
            perform={perform}
          />
          <PropertyActivity propertyId={id} />
        </div>
      </div>
    </>
  )
}
