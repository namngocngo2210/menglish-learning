'use client';

import React, { useState } from 'react';
import StudentHome from './student-home';
import StudentBrowser from './student-browser';
import StudentQuiz from './student-quiz';

export type StudentView = 'home' | 'browser' | 'quiz' | 'results';

interface StudentViewsProps {
  view: StudentView;
  onNavigate: (view: StudentView) => void;
}

export default function StudentViews({ view, onNavigate }: StudentViewsProps) {
  // Local grade filter state defaulting to 'all'
  const [grade, setGrade] = useState<string>('all');

  const handleBrowse = (selectedGrade: string) => {
    setGrade(selectedGrade);
    onNavigate('browser');
  };

  const handleStartQuiz = () => {
    onNavigate('quiz');
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-sky-50/30">
      {view === 'home' && (
        <StudentHome onBrowse={handleBrowse} />
      )}

      {view === 'browser' && (
        <StudentBrowser
          grade={grade}
          onGrade={setGrade}
          onStart={handleStartQuiz}
        />
      )}

      {/* Keep StudentQuiz mounted between 'quiz' and 'results' to preserve user answers */}
      {(view === 'quiz' || view === 'results') && (
        <StudentQuiz
          results={view === 'results'}
          onSubmit={() => onNavigate('results')}
          onRetry={() => onNavigate('quiz')}
        />
      )}
    </div>
  );
}
