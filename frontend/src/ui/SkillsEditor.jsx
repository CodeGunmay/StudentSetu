// Renders StudentSetu screens and handles student actions.
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import api from '../api';
import { useApp } from '../context/AppContext';
import BottomSheet from './BottomSheet';
import Button from './Button';
import { ChipInput, Field } from './Inputs';

/** Shared "edit my skills" sheet — used from Profile and from a dead-end search. */
export default function SkillsEditor({ open, onClose, teaches = [], wants = [] }) {
  const { toast, refreshUser } = useApp();
  const [teach, setTeach] = useState(teaches);
  const [learn, setLearn] = useState(wants);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTeach(teaches);
      setLearn(wants);
      setError('');
    }
  }, [open, teaches, wants]);

  const save = async () => {
    if (!teach.length) {
      setError('Add at least one skill you can teach — that is what makes a swap two-way.');
      return;
    }
    setBusy(true);
    try {
      await api.updateSkills({ teaches: teach, wants: learn });
      await refreshUser();
      toast('Skills updated — your matches are recalculated', 'success');
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Your skills"
      subtitle="Barter matches are built from these two lists"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" full onClick={onClose}>
            Cancel
          </Button>
          <Button full icon={Save} loading={busy} onClick={save}>
            Save skills
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <Field label="Skills I can teach" htmlFor="edit-teach" error={error}>
          <ChipInput id="edit-teach" values={teach} onChange={setTeach} placeholder="e.g. C++" />
        </Field>
        <Field label="Skills I want to learn" htmlFor="edit-learn" hint="Tap + or press Enter to add">
          <ChipInput id="edit-learn" values={learn} onChange={setLearn} placeholder="e.g. Python" tone="accent" />
        </Field>
      </div>
    </BottomSheet>
  );
}
