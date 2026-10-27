export type Course = {
  id: string;
  semester_id: string;
  name: string;
  credits: number;
  is_pf: boolean;
  grade: string | null;
};

export type Semester = {
  id: string;
  year: number;
  term: string;
  courses: Course[];
};

export type Stroke = {
  points: [number, number, number][]; // [x, y, 필압 0~1] (캔버스 논리 좌표)
  color: string;
  size: number;
  highlighter?: boolean;
};

export type Paper = "blank" | "lined" | "grid";

export type Drawing = {
  version: 1;
  paper?: Paper;
  pages: { strokes: Stroke[] }[];
};

export type Note = {
  id: string;
  course_id: string;
  kind: "markdown" | "drawing";
  title: string;
  content: string;
  drawing: Drawing | null;
  updated_at: string;
};

export type CourseFile = {
  id: string;
  course_id: string;
  name: string;
  storage_path: string;
  size: number;
  mime_type: string | null;
  created_at: string;
};
