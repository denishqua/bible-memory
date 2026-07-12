import { usePracticeSession } from '../../hooks/usePracticeSession';
import { HINT_XP_PENALTY } from '../../lib/xp';
import { Button } from '../ui/Button';

export function HintButton() {
  const useHint = usePracticeSession((s) => s.useHint);

  return (
    <Button type="button" variant="secondary" onClick={useHint}>
      Hint (-{HINT_XP_PENALTY} XP)
    </Button>
  );
}
