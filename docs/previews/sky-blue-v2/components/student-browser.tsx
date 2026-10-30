'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BookOpen, Filter, Clock, ArrowRight } from 'lucide-react';

interface StudentBrowserProps {
  grade: string;
  onGrade: (grade: string) => void;
  onStart: () => void;
}

interface Exercise {
  id: string;
  title: string;
  topic: string;
  grade: string;
  skill: string;
  skillLabel: string;
  difficulty: string;
  duration: string;
  summary: string;
}

const SAMPLE_EXERCISES: Exercise[] = [
  {
    id: 'ex-garden-6',
    title: 'Our Green School Garden',
    topic: 'School garden',
    grade: '6',
    skill: 'reading',
    skillLabel: 'Đọc hiểu',
    difficulty: 'Cơ bản',
    duration: '10 phút',
    summary: 'Tìm hiểu khu vườn thực nghiệm nhỏ tại trường và các loại rau xanh được học sinh khối 6 gieo trồng.',
  },
  {
    id: 'ex-school-7',
    title: 'A Typical Morning at School',
    topic: 'School life',
    grade: '7',
    skill: 'reading',
    skillLabel: 'Đọc hiểu',
    difficulty: 'Trung bình',
    duration: '15 phút',
    summary: 'Nhịp sống đầu ngày với góc thư viện mở, câu lạc bộ khoa học và hoạt động sinh hoạt nhóm năng động.',
  },
  {
    id: 'ex-community-8',
    title: 'Weekend Community Clean-Up',
    topic: 'Community',
    grade: '8',
    skill: 'vocabulary',
    skillLabel: 'Từ vựng',
    difficulty: 'Trung bình',
    duration: '15 phút',
    summary: 'Các thuật ngữ về bảo vệ mỹ quan đô thị, phân loại rác tái chế và tinh thần tình nguyện địa phương.',
  },
  {
    id: 'ex-env-9',
    title: 'City Wildlife & Environment',
    topic: 'Environment',
    grade: '9',
    skill: 'reading',
    skillLabel: 'Đọc hiểu',
    difficulty: 'Nâng cao',
    duration: '20 phút',
    summary: 'Bài phân tích về cân bằng sinh thái đô thị và giải pháp giảm thiểu khí thải cho thành phố xanh.',
  },
  {
    id: 'ex-garden-8',
    title: 'Composting and Natural Science',
    topic: 'School garden',
    grade: '8',
    skill: 'grammar',
    skillLabel: 'Ngữ pháp',
    difficulty: 'Trung bình',
    duration: '12 phút',
    summary: 'Luyện tập mệnh đề nguyên nhân - kết quả qua bài học ủ phân hữu cơ cho các luống hoa trong trường.',
  },
  {
    id: 'ex-school-6',
    title: 'Friendly Classmates & Clubs',
    topic: 'School life',
    grade: '6',
    skill: 'vocabulary',
    skillLabel: 'Từ vựng',
    difficulty: 'Cơ bản',
    duration: '10 phút',
    summary: 'Từ vựng miêu tả tính cách bạn bè và các hoạt động thể thao ngoại khóa sau giờ học.',
  },
];

export default function StudentBrowser({ grade, onGrade, onStart }: StudentBrowserProps) {
  const [skill, setSkill] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredExercises = useMemo(() => {
    return SAMPLE_EXERCISES.filter((item) => {
      const matchGrade = grade === 'all' || item.grade === grade;
      const matchSkill = skill === 'all' || item.skill === skill;
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        query === '' ||
        item.title.toLowerCase().includes(query) ||
        item.topic.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query);

      return matchGrade && matchSkill && matchSearch;
    });
  }, [grade, skill, searchQuery]);

  const isFiltered = grade !== 'all' || skill !== 'all' || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    onGrade('all');
    setSkill('all');
    setSearchQuery('');
  };

  return (
    <div className="w-full space-y-6">
      {/* Header section with brand and neutral preview badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sky-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Góc tiếng Anh
            </h2>
            <Badge variant="outline" className="border-sky-300 text-sky-700 bg-sky-50 text-xs font-medium">
              Tên tạm
            </Badge>
          </div>
          <p className="text-sm text-slate-600 leading-normal">
            Thư viện bài đọc luyện tập trực tuyến cho học sinh Trung học cơ sở (Khối 6 – 9).
          </p>
        </div>
        <div className="text-xs sm:text-sm font-medium text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-full self-start sm:self-auto">
          Hiển thị {filteredExercises.length} / {SAMPLE_EXERCISES.length} bài mẫu
        </div>
      </div>

      {/* Preview note: explains all cards launch the same demo quiz */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 sm:p-4 text-xs sm:text-sm text-sky-900 flex items-start gap-3">
        <BookOpen className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold text-sky-950">Lưu ý bản xem trước thiết kế (Preview Demo)</p>
          <p className="text-sky-800 leading-relaxed">
            Mọi bài tập trong danh mục này đều dẫn tới cùng một bài làm mẫu chủ đề{' '}
            <strong>School Garden (3 câu trắc nghiệm)</strong> để thử nghiệm giao diện đọc và chấm điểm.
          </p>
        </div>
      </div>

      {/* Search and filters bar */}
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-end">
          {/* Search Input */}
          <div className="md:col-span-5 space-y-1.5">
            <label htmlFor="search-exercises" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
              Tìm kiếm chủ đề hoặc từ khóa
            </label>
            <div className="relative">
              <Input
                id="search-exercises"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ví dụ: Garden, Environment, Lớp 7..."
                className="min-h-11 h-auto text-sm border-sky-200 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg pr-9"
              />
              <Search className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            </div>
          </div>

          {/* Grade Select */}
          <div className="md:col-span-3 space-y-1.5">
            <label htmlFor="grade-select" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
              Khối lớp
            </label>
            <Select value={grade} onValueChange={onGrade}>
              <SelectTrigger id="grade-select" className="min-h-11 h-auto text-sm border-sky-200 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg bg-white">
                <SelectValue placeholder="Chọn khối lớp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả khối lớp (6–9)</SelectItem>
                <SelectItem value="6">Lớp 6</SelectItem>
                <SelectItem value="7">Lớp 7</SelectItem>
                <SelectItem value="8">Lớp 8</SelectItem>
                <SelectItem value="9">Lớp 9</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Skill Select */}
          <div className="md:col-span-3 space-y-1.5">
            <label htmlFor="skill-select" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
              Kỹ năng
            </label>
            <Select value={skill} onValueChange={setSkill}>
              <SelectTrigger id="skill-select" className="min-h-11 h-auto text-sm border-sky-200 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg bg-white">
                <SelectValue placeholder="Chọn kỹ năng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả kỹ năng</SelectItem>
                <SelectItem value="reading">Đọc hiểu (Reading)</SelectItem>
                <SelectItem value="vocabulary">Từ vựng (Vocabulary)</SelectItem>
                <SelectItem value="grammar">Ngữ pháp (Grammar)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset button */}
          <div className="md:col-span-1">
            <Button
              type="button"
              variant="outline"
              disabled={!isFiltered}
              onClick={handleResetFilters}
              className="w-full min-h-11 h-auto border-sky-200 text-slate-600 hover:text-sky-700 hover:bg-sky-50 text-xs px-2 whitespace-normal"
            >
              Đặt lại
            </Button>
          </div>
        </div>
      </div>

      {/* Exercise cards grid or empty state */}
      {filteredExercises.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/40 p-8 text-center space-y-3">
          <BookOpen className="h-8 w-8 text-sky-400 mx-auto" aria-hidden="true" />
          <h3 className="text-base font-semibold text-slate-800">Không tìm thấy bài đọc phù hợp</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-normal">
            Không có bài đọc nào khớp với từ khóa hoặc bộ lọc hiện tại. Hãy xóa từ khóa hoặc đặt lại tiêu chí lọc.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleResetFilters}
            className="min-h-11 h-auto px-4 border-sky-300 text-sky-700 hover:bg-sky-100 rounded-lg text-sm"
          >
            Khôi phục tất cả bài tập
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredExercises.map((exercise) => (
            <Card
              key={exercise.id}
              className="border-sky-100 bg-white shadow-sm hover:border-sky-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <CardHeader className="p-4 sm:p-5 pb-3 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-800 text-xs font-semibold">
                    Lớp {exercise.grade}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-xs font-normal">
                    {exercise.skillLabel}
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 text-slate-600 text-xs font-normal">
                    {exercise.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words">
                  {exercise.title}
                </CardTitle>
                <CardDescription className="text-xs font-medium text-sky-700">
                  Chủ đề: {exercise.topic}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 pt-0 space-y-3 flex-1 flex flex-col justify-between">
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
                  {exercise.summary}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>Thời lượng: {exercise.duration}</span>
                </div>
              </CardContent>

              <CardFooter className="p-4 sm:p-5 pt-0">
                <Button
                  type="button"
                  onClick={onStart}
                  className="w-full min-h-11 h-auto py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg shadow-sm focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-normal text-sm flex items-center justify-center gap-2 group transition-colors duration-150"
                >
                  <span>Mở bài đọc mẫu</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
