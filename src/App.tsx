import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useContentProtection } from "@/lib/useContentProtection";
import Home from "@/pages/Home";
import Programs from "@/pages/Programs";
import ProgramDetail from "@/pages/ProgramDetail";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import FAQ from "@/pages/FAQ";
import Admissions from "@/pages/Admissions";
import Verify from "@/pages/Verify";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import StudentPortal from "@/pages/student/Portal";
import StudentPrograms from "@/pages/student/Programs";
import StudentProgramCourses from "@/pages/student/ProgramCourses";
import CourseDetail from "@/pages/student/CourseDetail";
import StudentAssessments from "@/pages/student/Assessments";
import AssessmentDetail from "@/pages/student/AssessmentDetail";
import StudentResults from "@/pages/student/Results";
import StudentAttendance from "@/pages/student/Attendance";
import StudentLibrary from "@/pages/student/Library";
import StudentPayments from "@/pages/student/Payments";
import StudentCertificates from "@/pages/student/Certificates";
import StudentAnnouncements from "@/pages/student/Announcements";
import StudentProfile from "@/pages/student/Profile";
import LecturerDashboard from "@/pages/lecturer/Dashboard";
import LecturerCourses from "@/pages/lecturer/Courses";
import LecturerAssessments from "@/pages/lecturer/Assessments";
import CourseMaterials from "@/pages/lecturer/CourseMaterials";
import CourseAssessments from "@/pages/lecturer/CourseAssessments";
import QuestionBuilder from "@/pages/lecturer/QuestionBuilder";
import AssessmentSubmissions from "@/pages/lecturer/AssessmentSubmissions";
import LecturerStudents from "@/pages/lecturer/Students";
import LecturerAttendance from "@/pages/lecturer/Attendance";
import Gradebook from "@/pages/lecturer/Gradebook";
import LecturerAnnouncements from "@/pages/lecturer/Announcements";
import LecturerResources from "@/pages/lecturer/Resources";
import LecturerProfile from "@/pages/lecturer/Profile";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminStudents from "@/pages/admin/Students";
import AdminFaculty from "@/pages/admin/Faculty";
import AdminCourses from "@/pages/admin/Courses";
import AdminCourseMaterials from "@/pages/admin/CourseMaterials";
import AdminPrograms from "@/pages/admin/Programs";
import AdminEnrollments from "@/pages/admin/Enrollments";
import AdminFinance from "@/pages/admin/Finance";
import AdminCertificates from "@/pages/admin/Certificates";
import AdminLeaders from "@/pages/admin/Leaders";
import AdminAnnouncements from "@/pages/admin/Announcements";
import AdminReports from "@/pages/admin/Reports";
import AdminSettings from "@/pages/admin/Settings";
import AdminContactMessages from "@/pages/admin/ContactMessages";
import AdminApplications from "@/pages/admin/Applications";
import NotFound from "@/pages/NotFound";

export default function App() {
  useContentProtection();
  const { pathname } = useLocation();

  // ✅ Scroll to top on every route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return (
    <Layout>
      <ErrorBoundary resetKey={pathname}>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/programs/:id" element={<ProgramDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/admissions" element={<Admissions />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/student" element={<ProtectedRoute roles={["student"]}><StudentPortal /></ProtectedRoute>} />
        <Route path="/student/courses" element={<ProtectedRoute roles={["student"]}><StudentPrograms /></ProtectedRoute>} />
        <Route path="/student/courses/program/:programId" element={<ProtectedRoute roles={["student"]}><StudentProgramCourses /></ProtectedRoute>} />
        <Route path="/student/courses/:id" element={<ProtectedRoute roles={["student"]}><CourseDetail /></ProtectedRoute>} />
        <Route path="/student/assessments" element={<ProtectedRoute roles={["student"]}><StudentAssessments /></ProtectedRoute>} />
        <Route path="/student/assessments/:id" element={<ProtectedRoute roles={["student"]}><AssessmentDetail /></ProtectedRoute>} />
        <Route path="/student/results" element={<ProtectedRoute roles={["student"]}><StudentResults /></ProtectedRoute>} />
        <Route path="/student/attendance" element={<ProtectedRoute roles={["student"]}><StudentAttendance /></ProtectedRoute>} />
        <Route path="/student/library" element={<ProtectedRoute roles={["student"]}><StudentLibrary /></ProtectedRoute>} />
        <Route path="/student/payments" element={<ProtectedRoute roles={["student"]}><StudentPayments /></ProtectedRoute>} />
        <Route path="/student/certificates" element={<ProtectedRoute roles={["student"]}><StudentCertificates /></ProtectedRoute>} />
        <Route path="/student/announcements" element={<ProtectedRoute roles={["student"]}><StudentAnnouncements /></ProtectedRoute>} />
        <Route path="/student/profile" element={<ProtectedRoute roles={["student"]}><StudentProfile /></ProtectedRoute>} />
        <Route path="/lecturer" element={<ProtectedRoute roles={["lecturer"]}><LecturerDashboard /></ProtectedRoute>} />
        <Route path="/lecturer/courses" element={<ProtectedRoute roles={["lecturer"]}><LecturerCourses /></ProtectedRoute>} />
        <Route path="/lecturer/assessments" element={<ProtectedRoute roles={["lecturer"]}><LecturerAssessments /></ProtectedRoute>} />
        <Route path="/lecturer/courses/:id/materials" element={<ProtectedRoute roles={["lecturer"]}><CourseMaterials /></ProtectedRoute>} />
        <Route path="/lecturer/courses/:id/assessments" element={<ProtectedRoute roles={["lecturer"]}><CourseAssessments /></ProtectedRoute>} />
        <Route path="/lecturer/assessments/:id/questions" element={<ProtectedRoute roles={["lecturer"]}><QuestionBuilder /></ProtectedRoute>} />
        <Route path="/lecturer/assessments/:id/submissions" element={<ProtectedRoute roles={["lecturer"]}><AssessmentSubmissions /></ProtectedRoute>} />
        <Route path="/lecturer/students" element={<ProtectedRoute roles={["lecturer"]}><LecturerStudents /></ProtectedRoute>} />
        <Route path="/lecturer/attendance" element={<ProtectedRoute roles={["lecturer"]}><LecturerAttendance /></ProtectedRoute>} />
        <Route path="/lecturer/gradebook" element={<ProtectedRoute roles={["lecturer"]}><Gradebook /></ProtectedRoute>} />
        <Route path="/lecturer/announcements" element={<ProtectedRoute roles={["lecturer"]}><LecturerAnnouncements /></ProtectedRoute>} />
        <Route path="/lecturer/resources" element={<ProtectedRoute roles={["lecturer"]}><LecturerResources /></ProtectedRoute>} />
        <Route path="/lecturer/profile" element={<ProtectedRoute roles={["lecturer"]}><LecturerProfile /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute roles={["admin"]}><AdminStudents /></ProtectedRoute>} />
        <Route path="/admin/faculty" element={<ProtectedRoute roles={["admin"]}><AdminFaculty /></ProtectedRoute>} />
        <Route path="/admin/courses" element={<ProtectedRoute roles={["admin"]}><AdminCourses /></ProtectedRoute>} />
        <Route path="/admin/courses/:id/materials" element={<ProtectedRoute roles={["admin"]}><AdminCourseMaterials /></ProtectedRoute>} />
        <Route path="/admin/programs" element={<ProtectedRoute roles={["admin"]}><AdminPrograms /></ProtectedRoute>} />
        <Route path="/admin/enrollments" element={<ProtectedRoute roles={["admin"]}><AdminEnrollments /></ProtectedRoute>} />
        <Route path="/admin/finance" element={<ProtectedRoute roles={["admin"]}><AdminFinance /></ProtectedRoute>} />
        <Route path="/admin/certificates" element={<ProtectedRoute roles={["admin"]}><AdminCertificates /></ProtectedRoute>} />
        <Route path="/admin/leaders" element={<ProtectedRoute roles={["admin"]}><AdminLeaders /></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute roles={["admin"]}><AdminAnnouncements /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute roles={["admin"]}><AdminReports /></ProtectedRoute>} />
        <Route path="/admin/applications" element={<ProtectedRoute roles={["admin"]}><AdminApplications /></ProtectedRoute>} />
          <Route path="/admin/contact-messages" element={<ProtectedRoute roles={["admin"]}><AdminContactMessages /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={["admin"]}><AdminSettings /></ProtectedRoute>} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}