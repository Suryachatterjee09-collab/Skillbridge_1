import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  colleges,
  communities,
  communityMembers,
  communityPosts,
  departments,
  profiles,
  projectMembers,
  projects,
  skills,
  userLearningSkills,
  userTeachingSkills,
} from './schema.ts';

let seedPromise: Promise<void> | null = null;

async function ensureCollege(input: {
  name: string;
  shortName: string;
  city: string;
  state: string;
  domain: string;
}) {
  const existing = await db
    .select()
    .from(colleges)
    .where(eq(colleges.shortName, input.shortName))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db
    .insert(colleges)
    .values({ ...input, isVerified: true })
    .returning();
  return created;
}

async function ensureDepartment(collegeId: number, name: string, code: string) {
  const allForCollege = await db
    .select()
    .from(departments)
    .where(eq(departments.collegeId, collegeId));
  const match = allForCollege.find((d) => d.code === code);
  if (match) return match;
  const [created] = await db
    .insert(departments)
    .values({ collegeId, name, code })
    .returning();
  return created;
}

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      // 1. Ensure Colleges
      const buie = await ensureCollege({
        name: 'Bankura Unnayani Institute of Engineering',
        shortName: 'BUIE',
        city: 'Bankura',
        state: 'West Bengal',
        domain: 'buie.ac.in',
      });
      const ju = await ensureCollege({
        name: 'Jadavpur University',
        shortName: 'JU',
        city: 'Kolkata',
        state: 'West Bengal',
        domain: 'jadavpuruniversity.in',
      });
      const nit = await ensureCollege({
        name: 'National Institute of Technology Durgapur',
        shortName: 'NIT Durgapur',
        city: 'Durgapur',
        state: 'West Bengal',
        domain: 'nitdgp.ac.in',
      });
      const iiest = await ensureCollege({
        name: 'IIEST Shibpur',
        shortName: 'IIEST',
        city: 'Howrah',
        state: 'West Bengal',
        domain: 'iiests.ac.in',
      });

      // 2. Ensure Departments across all colleges
      const buieCse = await ensureDepartment(buie.id, 'Computer Science & Engineering', 'CSE');
      const buieIt = await ensureDepartment(buie.id, 'Information Technology', 'IT');
      const buieEce = await ensureDepartment(buie.id, 'Electronics & Communication Engineering', 'ECE');
      const buieEe = await ensureDepartment(buie.id, 'Electrical Engineering', 'EE');
      const buieMe = await ensureDepartment(buie.id, 'Mechanical Engineering', 'ME');
      const buieCe = await ensureDepartment(buie.id, 'Civil Engineering', 'CE');

      const juCse = await ensureDepartment(ju.id, 'Computer Science & Engineering', 'CSE');
      const juEtce = await ensureDepartment(ju.id, 'Electronics & Telecommunication', 'ETCE');

      const nitCse = await ensureDepartment(nit.id, 'Computer Science & Engineering', 'CSE');
      const nitAids = await ensureDepartment(nit.id, 'AI & Data Science', 'AIDS');

      const iiestIt = await ensureDepartment(iiest.id, 'Information Technology', 'IT');

      // 3. Ensure Skills Catalog (covering software, AI, hardware, mobile, design, mechanical & civil)
      const skillSeeds = [
        { name: 'React & TypeScript', category: 'Frontend & UI', description: 'Component architecture, hooks, and strict TypeScript web apps.' },
        { name: 'Next.js', category: 'Frontend & UI', description: 'App Router, SSR, and full-stack React frameworks.' },
        { name: 'Tailwind CSS', category: 'Frontend & UI', description: 'Utility-first responsive design systems.' },
        { name: 'Figma & UI Systems', category: 'Design & Product', description: 'Wireframing, prototyping, and accessible component tokens.' },
        { name: 'UI/UX & Product Prototyping', category: 'Design & Product', description: 'User flows, usability testing, and interactive clickable prototypes.' },
        { name: 'Node.js & Express', category: 'Backend & Cloud', description: 'REST APIs, WebSockets, and authentication middleware.' },
        { name: 'PostgreSQL & Drizzle', category: 'Backend & Cloud', description: 'Relational schema modeling, indexing, and SQL queries.' },
        { name: 'Docker & Linux', category: 'Backend & Cloud', description: 'Containerization, deployment pipelines, and shell scripting.' },
        { name: 'Python & FastAPI', category: 'Backend & Cloud', description: 'High-performance Python APIs and scripting.' },
        { name: 'Machine Learning', category: 'AI & Data Science', description: 'Scikit-learn, model evaluation, and feature engineering.' },
        { name: 'Deep Learning & PyTorch', category: 'AI & Data Science', description: 'Neural networks, computer vision, and NLP transformers.' },
        { name: 'Generative AI & RAG', category: 'AI & Data Science', description: 'LLM integration, prompt engineering, and vector retrieval.' },
        { name: 'Data Structures & Algorithms', category: 'Competitive Programming', description: 'Graphs, dynamic programming, and interview problem solving.' },
        { name: 'C++ STL', category: 'Competitive Programming', description: 'Competitive coding templates and memory optimization.' },
        { name: 'Java & Spring Boot', category: 'Backend & Cloud', description: 'Enterprise backend services and OOP patterns.' },
        { name: 'Embedded C & ESP32', category: 'Systems & Embedded', description: 'Microcontroller firmware, sensors, and IoT telemetry.' },
        { name: 'VLSI & Verilog', category: 'Systems & Embedded', description: 'Digital logic synthesis and FPGA verification.' },
        { name: 'MATLAB & Simulink', category: 'Systems & Embedded', description: 'Signal processing and control systems simulation.' },
        { name: 'React Native', category: 'Mobile & Cross-Platform', description: 'Cross-platform mobile apps for iOS and Android.' },
        { name: 'Flutter & Dart', category: 'Mobile & Cross-Platform', description: 'Native-compiled mobile UI development.' },
        { name: 'Git & Open Source', category: 'Backend & Cloud', description: 'Branching workflows, PR reviews, and CI automation.' },
        { name: 'AutoCAD & SolidWorks', category: 'Mechanical & Civil CAD', description: '3D parametric modeling, assemblies, and engineering drafting.' },
        { name: 'Robotics & ROS2', category: 'Systems & Embedded', description: 'Autonomous navigation, kinematics, and sensor fusion.' },
        { name: 'Structural Analysis & STAAD', category: 'Mechanical & Civil CAD', description: 'Load modeling, concrete/steel design, and FEA simulation.' },
      ];

      for (const sk of skillSeeds) {
        await db.insert(skills).values(sk).onConflictDoNothing();
      }
      const allSkills = await db.select().from(skills);
      const skillByName = new Map(allSkills.map((s) => [s.name, s]));

      // 4. Ensure Student Profiles in every department/field
      const studentSeeds = [
        // BUIE CSE
        {
          uid: 'seed_buie_arjun',
          email: 'arjun.chatterjee@buie.internal',
          fullName: 'Arjun Chatterjee',
          username: 'arjun_buie_cse',
          avatarUrl: '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
          collegeId: buie.id,
          departmentId: buieCse.id,
          academicYear: '3rd Year',
          bio: 'Building full-stack TypeScript web tools at BUIE. Happy to mentor React & PostgreSQL in exchange for PyTorch or Embedded IoT guidance.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Mon', 'Wed', 'Fri', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 6 },
          githubUrl: 'https://github.com/arjunchatterjee',
          linkedinUrl: 'https://linkedin.com/in/arjunchatterjee',
          portfolioUrl: 'https://arjun.dev',
          teach: [
            { name: 'React & TypeScript', level: 'Advanced', description: 'Built 4 campus apps with strict TypeScript.' },
            { name: 'Node.js & Express', level: 'Advanced', description: 'REST APIs, WebSockets, and SQL pools.' },
            { name: 'PostgreSQL & Drizzle', level: 'Intermediate', description: 'Relational schema design & query tuning.' },
          ],
          learn: [
            { name: 'Deep Learning & PyTorch', targetLevel: 'Intermediate', notes: 'Want to build vision models for campus safety.' },
            { name: 'Docker & Linux', targetLevel: 'Intermediate', notes: 'Containerizing student hackathon deploys.' },
          ],
        },
        {
          uid: 'seed_buie_ananya',
          email: 'ananya.das@buie.internal',
          fullName: 'Ananya Das',
          username: 'ananya_buie_cse',
          avatarUrl: '/src/assets/images/avatar_student_ananya_1795456800848.jpg',
          collegeId: buie.id,
          departmentId: buieCse.id,
          academicYear: '2nd Year',
          bio: 'Product designer and frontend builder at BUIE. I run design critiques and Tailwind workshops, and I am learning DSA & System Design.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Wed', 'Fri', 'Sat', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 6 },
          githubUrl: 'https://github.com/ananyadas-ui',
          linkedinUrl: 'https://linkedin.com/in/ananyadas',
          portfolioUrl: 'https://ananyadas.design',
          teach: [
            { name: 'Figma & UI Systems', level: 'Advanced', description: 'Design tokens, prototyping, and accessibility.' },
            { name: 'Tailwind CSS', level: 'Advanced', description: 'Responsive layouts and dark mode palettes.' },
            { name: 'React & TypeScript', level: 'Intermediate', description: 'Interactive UI engineering.' },
          ],
          learn: [
            { name: 'Data Structures & Algorithms', targetLevel: 'Advanced', notes: 'Preparing for summer internship coding rounds.' },
            { name: 'PostgreSQL & Drizzle', targetLevel: 'Beginner', notes: 'Connecting frontends to real databases.' },
          ],
        },
        // BUIE IT
        {
          uid: 'seed_buie_priya',
          email: 'priya.sen@buie.internal',
          fullName: 'Priya Sen',
          username: 'priya_buie_it',
          avatarUrl: '/src/assets/images/avatar_student_priya_1795456800427.jpg',
          collegeId: buie.id,
          departmentId: buieIt.id,
          academicYear: '4th Year',
          bio: 'Final-year IT lead at BUIE focusing on applied ML and Python backends. Looking to sharpen UI design systems and React.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Tue', 'Thu', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/priyasen-ml',
          linkedinUrl: 'https://linkedin.com/in/priyasen',
          portfolioUrl: '',
          teach: [
            { name: 'Python & FastAPI', level: 'Expert', description: 'Production async ML inference services.' },
            { name: 'Deep Learning & PyTorch', level: 'Advanced', description: 'CNNs, transformers, and Kaggle pipelines.' },
            { name: 'Machine Learning', level: 'Advanced', description: 'Feature selection and scikit-learn.' },
          ],
          learn: [
            { name: 'React & TypeScript', targetLevel: 'Intermediate', notes: 'Want to ship interactive demos for my models.' },
            { name: 'Figma & UI Systems', targetLevel: 'Beginner', notes: 'Clean visual layout and typography.' },
          ],
        },
        {
          uid: 'seed_buie_koushik',
          email: 'koushik.saha@buie.internal',
          fullName: 'Koushik Saha',
          username: 'koushik_buie_it',
          avatarUrl: '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
          collegeId: buie.id,
          departmentId: buieIt.id,
          academicYear: '3rd Year',
          bio: 'Backend IT developer at BUIE working with Java Spring Boot and PostgreSQL microservices. Eager to build cross-platform React Native apps.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Mon', 'Thu', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/koushiksaha-dev',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'Java & Spring Boot', level: 'Advanced', description: 'REST microservices and database migrations.' },
            { name: 'PostgreSQL & Drizzle', level: 'Intermediate', description: 'SQL joins, indexing, and transactions.' },
          ],
          learn: [
            { name: 'React Native', targetLevel: 'Intermediate', notes: 'Building Android/iOS client apps.' },
            { name: 'Next.js', targetLevel: 'Intermediate', notes: 'Full-stack TypeScript web apps.' },
          ],
        },
        // BUIE ECE
        {
          uid: 'seed_buie_rohan',
          email: 'rohan.mukherjee@buie.internal',
          fullName: 'Rohan Mukherjee',
          username: 'rohan_buie_ece',
          avatarUrl: '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
          collegeId: buie.id,
          departmentId: buieEce.id,
          academicYear: '3rd Year',
          bio: 'ECE robotics enthusiast wiring ESP32 sensor nodes and Verilog testbenches. Seeking teammates who know React Native or Node.js dashboards.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Mon', 'Thu', 'Sun'], timeSlot: 'Night (9 PM - 11 PM)', hoursPerWeek: 7 },
          githubUrl: 'https://github.com/rohan-embedded',
          linkedinUrl: 'https://linkedin.com/in/rohanmukherjee',
          portfolioUrl: '',
          teach: [
            { name: 'Embedded C & ESP32', level: 'Advanced', description: 'MQTT telemetry, LoRa, and hardware debugging.' },
            { name: 'VLSI & Verilog', level: 'Intermediate', description: 'RTL modeling and simulation.' },
            { name: 'C++ STL', level: 'Intermediate', description: 'Fast algorithmic problem solving.' },
          ],
          learn: [
            { name: 'Node.js & Express', targetLevel: 'Intermediate', notes: 'Building real-time IoT ingestion backends.' },
            { name: 'React Native', targetLevel: 'Beginner', notes: 'Mobile companion apps for hardware.' },
          ],
        },
        {
          uid: 'seed_buie_neha',
          email: 'neha.dey@buie.internal',
          fullName: 'Neha Dey',
          username: 'neha_buie_ece',
          avatarUrl: '/src/assets/images/avatar_student_priya_1795456800427.jpg',
          collegeId: buie.id,
          departmentId: buieEce.id,
          academicYear: '4th Year',
          bio: 'Final-year ECE student at BUIE focusing on FPGA digital design and DSP filtering in MATLAB. Excited to pair on edge AI & Python.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Tue', 'Fri', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: '',
          linkedinUrl: 'https://linkedin.com/in/nehadey-ece',
          portfolioUrl: '',
          teach: [
            { name: 'VLSI & Verilog', level: 'Advanced', description: 'FSM synthesis and FPGA timing verification.' },
            { name: 'MATLAB & Simulink', level: 'Advanced', description: 'Digital signal processing & filter design.' },
          ],
          learn: [
            { name: 'Python & FastAPI', targetLevel: 'Intermediate', notes: 'Automating hardware test reports.' },
            { name: 'Generative AI & RAG', targetLevel: 'Beginner', notes: 'Exploring datasheet Q&A assistants.' },
          ],
        },
        // BUIE EE
        {
          uid: 'seed_buie_tanisha',
          email: 'tanisha.banerjee@buie.internal',
          fullName: 'Tanisha Banerjee',
          username: 'tanisha_buie_ee',
          avatarUrl: '/src/assets/images/avatar_student_ananya_1795456800848.jpg',
          collegeId: buie.id,
          departmentId: buieEe.id,
          academicYear: '2nd Year',
          bio: 'Electrical engineering student at BUIE working on smart grid analytics with MATLAB. Eager to learn Python and web visualization.',
          experienceLevel: 'Beginner',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Mon', 'Wed', 'Sat'], timeSlot: 'Afternoon (2 PM - 5 PM)', hoursPerWeek: 6 },
          githubUrl: '',
          linkedinUrl: 'https://linkedin.com/in/tanishabanerjee',
          portfolioUrl: '',
          teach: [
            { name: 'MATLAB & Simulink', level: 'Advanced', description: 'Power systems simulation & signal analysis.' },
            { name: 'Git & Open Source', level: 'Intermediate', description: 'Collaborative documentation & workflows.' },
          ],
          learn: [
            { name: 'Python & FastAPI', targetLevel: 'Intermediate', notes: 'Automating sensor data analysis.' },
            { name: 'React & TypeScript', targetLevel: 'Beginner', notes: 'Interactive lab dashboards.' },
          ],
        },
        {
          uid: 'seed_buie_sagnik',
          email: 'sagnik.bhattacharya@buie.internal',
          fullName: 'Sagnik Bhattacharya',
          username: 'sagnik_buie_ee',
          avatarUrl: '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
          collegeId: buie.id,
          departmentId: buieEe.id,
          academicYear: '3rd Year',
          bio: 'EE junior at BUIE building smart energy meters with ESP32 and relays. Looking to master Docker deployments and Node.js dashboards.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Tue', 'Thu', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/sagnik-ee',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'Embedded C & ESP32', level: 'Intermediate', description: 'AC current sensing and relay control.' },
            { name: 'MATLAB & Simulink', level: 'Intermediate', description: 'Power electronics converter modeling.' },
          ],
          learn: [
            { name: 'Node.js & Express', targetLevel: 'Intermediate', notes: 'Real-time smart meter telemetry APIs.' },
            { name: 'Docker & Linux', targetLevel: 'Beginner', notes: 'Self-hosting campus lab servers.' },
          ],
        },
        // BUIE ME (Mechanical Engineering)
        {
          uid: 'seed_buie_subhajit',
          email: 'subhajit.kundu@buie.internal',
          fullName: 'Subhajit Kundu',
          username: 'subhajit_buie_me',
          avatarUrl: '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
          collegeId: buie.id,
          departmentId: buieMe.id,
          academicYear: '3rd Year',
          bio: 'Mechanical engineering student at BUIE designing robotic arms in SolidWorks and simulating kinematics. Looking to learn Python & ROS2.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Mon', 'Wed', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 6 },
          githubUrl: '',
          linkedinUrl: 'https://linkedin.com/in/subhajitkundu',
          portfolioUrl: '',
          teach: [
            { name: 'AutoCAD & SolidWorks', level: 'Advanced', description: 'Parametric CAD assemblies and 3D printing prep.' },
            { name: 'MATLAB & Simulink', level: 'Intermediate', description: 'Mechanical vibration and control modeling.' },
          ],
          learn: [
            { name: 'Robotics & ROS2', targetLevel: 'Intermediate', notes: 'Controlling multi-axis robotic actuators.' },
            { name: 'Python & FastAPI', targetLevel: 'Beginner', notes: 'Automating CAD & simulation scripts.' },
          ],
        },
        {
          uid: 'seed_buie_megha',
          email: 'megha.chakraborty@buie.internal',
          fullName: 'Megha Chakraborty',
          username: 'megha_buie_me',
          avatarUrl: '/src/assets/images/avatar_student_ananya_1795456800848.jpg',
          collegeId: buie.id,
          departmentId: buieMe.id,
          academicYear: '4th Year',
          bio: 'BUIE Mechanical senior leading our campus robotics rover build. I teach ROS2 & CAD workflows and want to learn React & Tailwind UIs.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Tue', 'Thu', 'Sat'], timeSlot: 'Afternoon (2 PM - 5 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/megha-robotics',
          linkedinUrl: 'https://linkedin.com/in/meghachakraborty',
          portfolioUrl: '',
          teach: [
            { name: 'Robotics & ROS2', level: 'Advanced', description: 'Autonomous rover SLAM and URDF modeling.' },
            { name: 'AutoCAD & SolidWorks', level: 'Advanced', description: 'Chassis fabrication & tolerance drafting.' },
          ],
          learn: [
            { name: 'React & TypeScript', targetLevel: 'Intermediate', notes: 'Building a web telemetry console for our rover.' },
            { name: 'Tailwind CSS', targetLevel: 'Beginner', notes: 'Clean mission control dashboards.' },
          ],
        },
        // BUIE CE (Civil Engineering)
        {
          uid: 'seed_buie_sayantan',
          email: 'sayantan.paul@buie.internal',
          fullName: 'Sayantan Paul',
          username: 'sayantan_buie_ce',
          avatarUrl: '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
          collegeId: buie.id,
          departmentId: buieCe.id,
          academicYear: '3rd Year',
          bio: 'Civil engineering student at BUIE specializing in STAAD structural modeling and AutoCAD floor plans. Learning Python & ML for smart cities.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Wed', 'Fri', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 4 },
          githubUrl: '',
          linkedinUrl: 'https://linkedin.com/in/sayantanpaul-ce',
          portfolioUrl: '',
          teach: [
            { name: 'Structural Analysis & STAAD', level: 'Advanced', description: 'Seismic load analysis and RCC frame design.' },
            { name: 'AutoCAD & SolidWorks', level: 'Advanced', description: '2D architectural layouts and structural detailing.' },
          ],
          learn: [
            { name: 'Machine Learning', targetLevel: 'Beginner', notes: 'Predicting concrete strength and material costs.' },
            { name: 'Python & FastAPI', targetLevel: 'Beginner', notes: 'Processing geotechnical survey CSV datasets.' },
          ],
        },
        {
          uid: 'seed_buie_ishita',
          email: 'ishita.roy@buie.internal',
          fullName: 'Ishita Roy',
          username: 'ishita_buie_ce',
          avatarUrl: '/src/assets/images/avatar_student_priya_1795456800427.jpg',
          collegeId: buie.id,
          departmentId: buieCe.id,
          academicYear: '2nd Year',
          bio: 'Civil engineering sophomore at BUIE passionate about sustainable green buildings and CAD drafting. Want to build web tools with Figma & React.',
          experienceLevel: 'Beginner',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Mon', 'Thu', 'Sat'], timeSlot: 'Afternoon (2 PM - 5 PM)', hoursPerWeek: 5 },
          githubUrl: '',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'AutoCAD & SolidWorks', level: 'Intermediate', description: 'Site plans, elevation drawings, and quantity takeoffs.' },
            { name: 'Structural Analysis & STAAD', level: 'Intermediate', description: 'Truss and beam bending moment analysis.' },
          ],
          learn: [
            { name: 'Figma & UI Systems', targetLevel: 'Intermediate', notes: 'Designing interactive campus map tools.' },
            { name: 'React & TypeScript', targetLevel: 'Beginner', notes: 'Building a civil material calculator.' },
          ],
        },
        // JU CSE
        {
          uid: 'seed_ju_sourav',
          email: 'sourav.mondal@ju.internal',
          fullName: 'Sourav Mondal',
          username: 'sourav_ju_cse',
          avatarUrl: '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
          collegeId: ju.id,
          departmentId: juCse.id,
          academicYear: '4th Year',
          bio: 'ICPC regionalist and backend systems intern from Jadavpur University. Always up for pairing with BUIE & NIT peers on open-source tooling.',
          experienceLevel: 'Expert',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Tue', 'Sat', 'Sun'], timeSlot: 'Night (9 PM - 11 PM)', hoursPerWeek: 4 },
          githubUrl: 'https://github.com/sourav-cp',
          linkedinUrl: 'https://linkedin.com/in/souravmondal',
          portfolioUrl: '',
          teach: [
            { name: 'Data Structures & Algorithms', level: 'Expert', description: 'Graphs, segment trees, and DP patterns.' },
            { name: 'C++ STL', level: 'Expert', description: 'Competitive programming mastery.' },
            { name: 'Docker & Linux', level: 'Advanced', description: 'Linux internals & container workflows.' },
          ],
          learn: [
            { name: 'Generative AI & RAG', targetLevel: 'Intermediate', notes: 'Building developer productivity agents.' },
            { name: 'Next.js', targetLevel: 'Intermediate', notes: 'Modern web deployment.' },
          ],
        },
        // JU ETCE
        {
          uid: 'seed_ju_swastika',
          email: 'swastika.bose@ju.internal',
          fullName: 'Swastika Bose',
          username: 'swastika_ju_etce',
          avatarUrl: '/src/assets/images/avatar_student_ananya_1795456800848.jpg',
          collegeId: ju.id,
          departmentId: juEtce.id,
          academicYear: '3rd Year',
          bio: 'ETCE undergrad at Jadavpur University working on low-power VLSI and embedded computer vision. Looking for PyTorch & UI partners.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Mon', 'Wed', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/swastikabose-etce',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'VLSI & Verilog', level: 'Advanced', description: 'ASIC RTL design and simulation.' },
            { name: 'Embedded C & ESP32', level: 'Advanced', description: 'Edge microcontroller interfaces.' },
          ],
          learn: [
            { name: 'Deep Learning & PyTorch', targetLevel: 'Intermediate', notes: 'Quantizing vision models for edge boards.' },
            { name: 'React & TypeScript', targetLevel: 'Beginner', notes: 'Visualizing sensor telemetry.' },
          ],
        },
        // NIT Durgapur CSE
        {
          uid: 'seed_nit_devansh',
          email: 'devansh.verma@nitdgp.internal',
          fullName: 'Devansh Verma',
          username: 'devansh_nit_cse',
          avatarUrl: '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
          collegeId: nit.id,
          departmentId: nitCse.id,
          academicYear: '3rd Year',
          bio: 'CSE junior at NIT Durgapur focused on Next.js, Docker, and scalable system design. Keen to collaborate on competitive programming & AI.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Hindi'],
          availability: { days: ['Tue', 'Thu', 'Sat'], timeSlot: 'Night (9 PM - 11 PM)', hoursPerWeek: 6 },
          githubUrl: 'https://github.com/devanshverma',
          linkedinUrl: 'https://linkedin.com/in/devanshverma',
          portfolioUrl: '',
          teach: [
            { name: 'Next.js', level: 'Advanced', description: 'Server actions, caching, and TypeScript apps.' },
            { name: 'Docker & Linux', level: 'Advanced', description: 'Compose stacks and GitHub Actions CI.' },
          ],
          learn: [
            { name: 'Generative AI & RAG', targetLevel: 'Advanced', notes: 'Vector search and structured evaluation.' },
            { name: 'Data Structures & Algorithms', targetLevel: 'Advanced', notes: 'Hard graph & DP rounds.' },
          ],
        },
        // NIT Durgapur AIDS
        {
          uid: 'seed_nit_ritika',
          email: 'ritika.roy@nitdgp.internal',
          fullName: 'Ritika Roy',
          username: 'ritika_nit_aids',
          avatarUrl: '/src/assets/images/avatar_student_priya_1795456800427.jpg',
          collegeId: nit.id,
          departmentId: nitAids.id,
          academicYear: '3rd Year',
          bio: 'AI & Data Science junior at NIT Durgapur working on retrieval-augmented study tools. Looking for frontend & mobile partners.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Hindi', 'Bengali'],
          availability: { days: ['Mon', 'Wed', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/ritikaroy-ai',
          linkedinUrl: 'https://linkedin.com/in/ritikaroy',
          portfolioUrl: '',
          teach: [
            { name: 'Generative AI & RAG', level: 'Advanced', description: 'Structured outputs and grounding.' },
            { name: 'Machine Learning', level: 'Advanced', description: 'Applied NLP & tabular modeling.' },
          ],
          learn: [
            { name: 'Next.js', targetLevel: 'Intermediate', notes: 'Shipping clean AI web interfaces.' },
            { name: 'Flutter & Dart', targetLevel: 'Beginner', notes: 'Cross-platform study companions.' },
          ],
        },
        // IIEST Shibpur IT
        {
          uid: 'seed_iiest_debjit',
          email: 'debjit.ghosh@iiest.internal',
          fullName: 'Debjit Ghosh',
          username: 'debjit_iiest_it',
          avatarUrl: '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
          collegeId: iiest.id,
          departmentId: iiestIt.id,
          academicYear: '3rd Year',
          bio: 'Mobile & Java backend builder at IIEST Shibpur. Enjoy mentoring cross-platform Flutter apps and learning cloud DevOps.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Thu', 'Fri', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/debjit-mobile',
          linkedinUrl: 'https://linkedin.com/in/debjitghosh',
          portfolioUrl: '',
          teach: [
            { name: 'Flutter & Dart', level: 'Advanced', description: 'State management & clean mobile UI.' },
            { name: 'Java & Spring Boot', level: 'Intermediate', description: 'Microservices & JWT auth.' },
          ],
          learn: [
            { name: 'Docker & Linux', targetLevel: 'Advanced', notes: 'Production CI/CD automation.' },
            { name: 'React & TypeScript', targetLevel: 'Intermediate', notes: 'Web dashboard parity.' },
          ],
        },
        {
          uid: 'seed_iiest_tathagata',
          email: 'tathagata.roy@iiest.internal',
          fullName: 'Tathagata Roy',
          username: 'tathagata_iiest_it',
          avatarUrl: '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
          collegeId: iiest.id,
          departmentId: iiestIt.id,
          academicYear: '2nd Year',
          bio: 'Mobile UI & React Native builder at IIEST Shibpur. Happy to trade mobile dev help for PostgreSQL or Competitive Programming.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Mon', 'Fri', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 4 },
          githubUrl: 'https://github.com/tathagata-rn',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'React Native', level: 'Advanced', description: 'Expo, animations, and offline storage.' },
            { name: 'Tailwind CSS', level: 'Intermediate', description: 'Responsive component systems.' },
          ],
          learn: [
            { name: 'PostgreSQL & Drizzle', targetLevel: 'Intermediate', notes: 'Backend persistence for mobile apps.' },
            { name: 'C++ STL', targetLevel: 'Intermediate', notes: 'Campus placement DSA prep.' },
          ],
        },
        // Additional students across every skill field (10+ students per skill category)
        {
          uid: 'seed_buie_soumya',
          email: 'soumya.pal@buie.internal',
          fullName: 'Soumya Pal',
          username: 'soumya_buie_cse',
          avatarUrl: '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
          collegeId: buie.id,
          departmentId: buieCse.id,
          academicYear: '3rd Year',
          bio: 'Competitive coder and Express API builder at BUIE. Looking to team up with product designers and mobile devs.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Tue', 'Thu', 'Sat'], timeSlot: 'Night (9 PM - 11 PM)', hoursPerWeek: 6 },
          githubUrl: 'https://github.com/soumyapal-cp',
          linkedinUrl: 'https://linkedin.com/in/soumyapal',
          portfolioUrl: '',
          teach: [
            { name: 'Data Structures & Algorithms', level: 'Advanced', description: 'Trees, DP, and contest problem walkthroughs.' },
            { name: 'C++ STL', level: 'Advanced', description: 'Standard library containers & fast I/O.' },
            { name: 'Node.js & Express', level: 'Intermediate', description: 'Authentication & RESTful services.' },
          ],
          learn: [
            { name: 'Figma & UI Systems', targetLevel: 'Intermediate', notes: 'Designing cleaner student project UIs.' },
            { name: 'React Native', targetLevel: 'Beginner', notes: 'Shipping cross-platform mobile apps.' },
          ],
        },
        {
          uid: 'seed_buie_aditi',
          email: 'aditi.sen@buie.internal',
          fullName: 'Aditi Sen',
          username: 'aditi_buie_it',
          avatarUrl: '/src/assets/images/avatar_student_ananya_1795456800848.jpg',
          collegeId: buie.id,
          departmentId: buieIt.id,
          academicYear: '2nd Year',
          bio: 'UI/UX designer at BUIE IT crafting Figma prototypes and Tailwind design systems. Learning Flutter and PyTorch.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Mon', 'Wed', 'Fri'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/aditisen-ux',
          linkedinUrl: 'https://linkedin.com/in/aditisen',
          portfolioUrl: 'https://aditidesigns.in',
          teach: [
            { name: 'Figma & UI Systems', level: 'Advanced', description: 'Auto-layout, typography scales, and design tokens.' },
            { name: 'UI/UX & Product Prototyping', level: 'Advanced', description: 'User journey mapping & clickable prototypes.' },
            { name: 'Tailwind CSS', level: 'Intermediate', description: 'Utility-first component styling.' },
          ],
          learn: [
            { name: 'Flutter & Dart', targetLevel: 'Intermediate', notes: 'Translating Figma mocks to native mobile apps.' },
            { name: 'Deep Learning & PyTorch', targetLevel: 'Beginner', notes: 'Exploring generative visual tools.' },
          ],
        },
        {
          uid: 'seed_buie_rudra',
          email: 'rudra.chatterjee@buie.internal',
          fullName: 'Rudra Chatterjee',
          username: 'rudra_buie_me',
          avatarUrl: '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
          collegeId: buie.id,
          departmentId: buieMe.id,
          academicYear: '2nd Year',
          bio: 'BUIE Mechanical sophomore building SolidWorks mechanisms and ROS2 simulations. Looking for C++ and ESP32 peers.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Mon', 'Thu', 'Sat'], timeSlot: 'Afternoon (2 PM - 5 PM)', hoursPerWeek: 5 },
          githubUrl: '',
          linkedinUrl: 'https://linkedin.com/in/rudrachatterjee',
          portfolioUrl: '',
          teach: [
            { name: 'AutoCAD & SolidWorks', level: 'Advanced', description: '3D gear trains and mechanical drafting.' },
            { name: 'Robotics & ROS2', level: 'Intermediate', description: 'Gazebo robot simulation & URDF models.' },
          ],
          learn: [
            { name: 'C++ STL', targetLevel: 'Intermediate', notes: 'Writing fast robotics path planners.' },
            { name: 'Embedded C & ESP32', targetLevel: 'Intermediate', notes: 'Motor drivers & IMU telemetry.' },
          ],
        },
        {
          uid: 'seed_buie_shreya',
          email: 'shreya.nandi@buie.internal',
          fullName: 'Shreya Nandi',
          username: 'shreya_buie_ce',
          avatarUrl: '/src/assets/images/avatar_student_priya_1795456800427.jpg',
          collegeId: buie.id,
          departmentId: buieCe.id,
          academicYear: '4th Year',
          bio: 'Civil engineering senior at BUIE teaching STAAD structural design & AutoCAD drafting. Learning ML and UI systems.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Tue', 'Fri', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 4 },
          githubUrl: '',
          linkedinUrl: 'https://linkedin.com/in/shreyanandi-ce',
          portfolioUrl: '',
          teach: [
            { name: 'Structural Analysis & STAAD', level: 'Expert', description: 'Multi-storey RCC & steel truss analysis.' },
            { name: 'AutoCAD & SolidWorks', level: 'Advanced', description: 'Civil CAD floor plans & section drawings.' },
          ],
          learn: [
            { name: 'Machine Learning', targetLevel: 'Intermediate', notes: 'Predictive structural health analytics.' },
            { name: 'Figma & UI Systems', targetLevel: 'Beginner', notes: 'Presenting engineering dashboards clearly.' },
          ],
        },
        {
          uid: 'seed_buie_kaustav',
          email: 'kaustav.roy@buie.internal',
          fullName: 'Kaustav Roy',
          username: 'kaustav_buie_me',
          avatarUrl: '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
          collegeId: buie.id,
          departmentId: buieMe.id,
          academicYear: '4th Year',
          bio: 'Mechanical final-year student at BUIE focusing on CAD assemblies and Simulink thermal models. Interested in React Native & GenAI.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Wed', 'Sat', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: '',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'AutoCAD & SolidWorks', level: 'Expert', description: 'Sheet metal design & motion study simulations.' },
            { name: 'MATLAB & Simulink', level: 'Advanced', description: 'Dynamic system modeling & PID tuning.' },
          ],
          learn: [
            { name: 'React Native', targetLevel: 'Beginner', notes: 'Mobile workshop checklist app.' },
            { name: 'Generative AI & RAG', targetLevel: 'Beginner', notes: 'Querying engineering handbooks.' },
          ],
        },
        {
          uid: 'seed_buie_arpita',
          email: 'arpita.mondal@buie.internal',
          fullName: 'Arpita Mondal',
          username: 'arpita_buie_ece',
          avatarUrl: '/src/assets/images/avatar_student_ananya_1795456800848.jpg',
          collegeId: buie.id,
          departmentId: buieEce.id,
          academicYear: '2nd Year',
          bio: 'ECE student at BUIE pairing ESP32 IoT sensors with Flutter mobile apps. Excited to learn UI/UX prototyping & DSA.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Mon', 'Wed', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 6 },
          githubUrl: 'https://github.com/arpita-iot',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'Embedded C & ESP32', level: 'Intermediate', description: 'BLE & Wi-Fi sensor streaming.' },
            { name: 'Flutter & Dart', level: 'Intermediate', description: 'Real-time IoT companion apps.' },
          ],
          learn: [
            { name: 'UI/UX & Product Prototyping', targetLevel: 'Intermediate', notes: 'Polishing mobile onboarding flows.' },
            { name: 'Data Structures & Algorithms', targetLevel: 'Intermediate', notes: 'Placement interview prep.' },
          ],
        },
        {
          uid: 'seed_buie_niladri',
          email: 'niladri.biswas@buie.internal',
          fullName: 'Niladri Biswas',
          username: 'niladri_buie_ee',
          avatarUrl: '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
          collegeId: buie.id,
          departmentId: buieEe.id,
          academicYear: '4th Year',
          bio: 'Electrical senior at BUIE working on motor control in Simulink and ESP32 hardware. Eager to pick up CAD enclosures & React Native.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Tue', 'Thu', 'Sun'], timeSlot: 'Night (9 PM - 11 PM)', hoursPerWeek: 4 },
          githubUrl: '',
          linkedinUrl: 'https://linkedin.com/in/niladribiswas',
          portfolioUrl: '',
          teach: [
            { name: 'MATLAB & Simulink', level: 'Expert', description: 'Power electronics & control loops.' },
            { name: 'Embedded C & ESP32', level: 'Advanced', description: 'PWM inverter control & telemetry.' },
          ],
          learn: [
            { name: 'AutoCAD & SolidWorks', targetLevel: 'Beginner', notes: 'Designing 3D-printed controller enclosures.' },
            { name: 'React Native', targetLevel: 'Beginner', notes: 'Mobile EV battery monitor.' },
          ],
        },
        {
          uid: 'seed_buie_parthib',
          email: 'parthib.sarkar@buie.internal',
          fullName: 'Parthib Sarkar',
          username: 'parthib_buie_ce',
          avatarUrl: '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
          collegeId: buie.id,
          departmentId: buieCe.id,
          academicYear: '3rd Year',
          bio: 'Civil engineering junior at BUIE into BIM drafting, AutoCAD, and STAAD Pro. Learning Flutter & UX design for site inspection tools.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Mon', 'Fri', 'Sat'], timeSlot: 'Afternoon (2 PM - 5 PM)', hoursPerWeek: 5 },
          githubUrl: '',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'AutoCAD & SolidWorks', level: 'Advanced', description: 'Drafting structural & site blueprints.' },
            { name: 'Structural Analysis & STAAD', level: 'Intermediate', description: 'Beam & column load calculations.' },
          ],
          learn: [
            { name: 'Flutter & Dart', targetLevel: 'Intermediate', notes: 'Offline construction checklist mobile app.' },
            { name: 'UI/UX & Product Prototyping', targetLevel: 'Beginner', notes: 'Field-friendly mobile interfaces.' },
          ],
        },
        {
          uid: 'seed_buie_trisha',
          email: 'trisha.karmakar@buie.internal',
          fullName: 'Trisha Karmakar',
          username: 'trisha_buie_cse',
          avatarUrl: '/src/assets/images/avatar_student_priya_1795456800427.jpg',
          collegeId: buie.id,
          departmentId: buieCse.id,
          academicYear: '4th Year',
          bio: 'BUIE CSE senior building React Native & TypeScript apps with polished Figma systems. Trading frontend/mobile help for DSA & GenAI.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Tue', 'Thu', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 6 },
          githubUrl: 'https://github.com/trisha-rn',
          linkedinUrl: 'https://linkedin.com/in/trishakarmakar',
          portfolioUrl: '',
          teach: [
            { name: 'React Native', level: 'Advanced', description: 'Expo Router, native modules, and animations.' },
            { name: 'React & TypeScript', level: 'Advanced', description: 'Type-safe frontend architecture.' },
            { name: 'Figma & UI Systems', level: 'Intermediate', description: 'Component libraries & handoff.' },
          ],
          learn: [
            { name: 'Data Structures & Algorithms', targetLevel: 'Advanced', notes: 'Final-year technical interview prep.' },
            { name: 'Generative AI & RAG', targetLevel: 'Intermediate', notes: 'Adding smart search to mobile apps.' },
          ],
        },
        {
          uid: 'seed_buie_subham',
          email: 'subham.halder@buie.internal',
          fullName: 'Subham Halder',
          username: 'subham_buie_it',
          avatarUrl: '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
          collegeId: buie.id,
          departmentId: buieIt.id,
          academicYear: '3rd Year',
          bio: 'IT student at BUIE shipping Flutter mobile apps backed by Node.js. Looking to level up C++ STL & Figma product design.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Wed', 'Fri', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/subhamhalder',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'Flutter & Dart', level: 'Advanced', description: 'Riverpod state & Firebase/REST integration.' },
            { name: 'Node.js & Express', level: 'Intermediate', description: 'API auth & real-time sockets.' },
          ],
          learn: [
            { name: 'C++ STL', targetLevel: 'Intermediate', notes: 'Timed coding challenges.' },
            { name: 'Figma & UI Systems', targetLevel: 'Beginner', notes: 'Improving app visual polish.' },
          ],
        },
        {
          uid: 'seed_ju_agnik',
          email: 'agnik.sengupta@ju.internal',
          fullName: 'Agnik Sengupta',
          username: 'agnik_ju_cse',
          avatarUrl: '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
          collegeId: ju.id,
          departmentId: juCse.id,
          academicYear: '3rd Year',
          bio: 'Jadavpur CSE junior into competitive programming and PyTorch computer vision. Curious about UI/UX prototyping and CAD.',
          experienceLevel: 'Expert',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Mon', 'Thu', 'Sat'], timeSlot: 'Night (9 PM - 11 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/agnik-ju',
          linkedinUrl: 'https://linkedin.com/in/agniksengupta',
          portfolioUrl: '',
          teach: [
            { name: 'Data Structures & Algorithms', level: 'Expert', description: 'Graph algorithms & dynamic programming.' },
            { name: 'C++ STL', level: 'Expert', description: 'Templates, bitmasks, and CP speed.' },
            { name: 'Deep Learning & PyTorch', level: 'Advanced', description: 'Vision transformers & segmentation.' },
          ],
          learn: [
            { name: 'UI/UX & Product Prototyping', targetLevel: 'Beginner', notes: 'Designing demos for research tools.' },
            { name: 'AutoCAD & SolidWorks', targetLevel: 'Beginner', notes: '3D-printed camera mounts for vision rigs.' },
          ],
        },
        {
          uid: 'seed_ju_debarati',
          email: 'debarati.roy@ju.internal',
          fullName: 'Debarati Roy',
          username: 'debarati_ju_etce',
          avatarUrl: '/src/assets/images/avatar_student_ananya_1795456800848.jpg',
          collegeId: ju.id,
          departmentId: juEtce.id,
          academicYear: '2nd Year',
          bio: 'JU ETCE sophomore building autonomous ROS2 bots and Verilog modules. Seeking partners for Flutter & Figma interfaces.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Tue', 'Fri', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/debarati-ros',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'Robotics & ROS2', level: 'Intermediate', description: 'Sensor nodes & differential drive control.' },
            { name: 'VLSI & Verilog', level: 'Intermediate', description: 'Digital RTL testbenches.' },
          ],
          learn: [
            { name: 'Flutter & Dart', targetLevel: 'Intermediate', notes: 'Handheld robot controller app.' },
            { name: 'Figma & UI Systems', targetLevel: 'Beginner', notes: 'Clean telemetry layouts.' },
          ],
        },
        {
          uid: 'seed_nit_aayush',
          email: 'aayush.tiwari@nitdgp.internal',
          fullName: 'Aayush Tiwari',
          username: 'aayush_nit_cse',
          avatarUrl: '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
          collegeId: nit.id,
          departmentId: nitCse.id,
          academicYear: '4th Year',
          bio: 'NIT Durgapur CSE senior mentoring C++ DSA and FastAPI backends. Exploring React Native and product prototyping.',
          experienceLevel: 'Expert',
          preferredLanguages: ['English', 'Hindi'],
          availability: { days: ['Mon', 'Wed', 'Sun'], timeSlot: 'Night (9 PM - 11 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/aayushtiwari',
          linkedinUrl: 'https://linkedin.com/in/aayushtiwari',
          portfolioUrl: '',
          teach: [
            { name: 'C++ STL', level: 'Expert', description: 'Competitive coding & interview patterns.' },
            { name: 'Data Structures & Algorithms', level: 'Expert', description: 'Trees, tries, and greedy optimization.' },
            { name: 'Python & FastAPI', level: 'Advanced', description: 'High-throughput REST APIs.' },
          ],
          learn: [
            { name: 'React Native', targetLevel: 'Intermediate', notes: 'Mobile side-projects.' },
            { name: 'UI/UX & Product Prototyping', targetLevel: 'Beginner', notes: 'Rapid user validation.' },
          ],
        },
        {
          uid: 'seed_nit_sneha',
          email: 'sneha.kulkarni@nitdgp.internal',
          fullName: 'Sneha Kulkarni',
          username: 'sneha_nit_aids',
          avatarUrl: '/src/assets/images/avatar_student_priya_1795456800427.jpg',
          collegeId: nit.id,
          departmentId: nitAids.id,
          academicYear: '2nd Year',
          bio: 'AI & Data Science student at NIT Durgapur blending RAG pipelines with clean UX prototyping. Learning DSA & CAD.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Hindi'],
          availability: { days: ['Tue', 'Thu', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 6 },
          githubUrl: 'https://github.com/snehakulkarni-ai',
          linkedinUrl: 'https://linkedin.com/in/snehakulkarni',
          portfolioUrl: '',
          teach: [
            { name: 'Machine Learning', level: 'Advanced', description: 'Classification, clustering & model interpretability.' },
            { name: 'Generative AI & RAG', level: 'Intermediate', description: 'Prompt workflows & document retrieval.' },
            { name: 'UI/UX & Product Prototyping', level: 'Intermediate', description: 'Human-centered AI interfaces.' },
          ],
          learn: [
            { name: 'AutoCAD & SolidWorks', targetLevel: 'Beginner', notes: 'Prototyping hardware AI enclosures.' },
            { name: 'Data Structures & Algorithms', targetLevel: 'Intermediate', notes: 'Core CS algorithms.' },
          ],
        },
        {
          uid: 'seed_iiest_aritro',
          email: 'aritro.majumdar@iiest.internal',
          fullName: 'Aritro Majumdar',
          username: 'aritro_iiest_it',
          avatarUrl: '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
          collegeId: iiest.id,
          departmentId: iiestIt.id,
          academicYear: '4th Year',
          bio: 'IIEST Shibpur IT senior specializing in Flutter, React Native, and Dockerized deployments. Curious about PyTorch & structural engineering tools.',
          experienceLevel: 'Advanced',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Wed', 'Sat', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: 'https://github.com/aritromajumdar',
          linkedinUrl: 'https://linkedin.com/in/aritromajumdar',
          portfolioUrl: '',
          teach: [
            { name: 'Flutter & Dart', level: 'Expert', description: 'Production mobile architecture & animations.' },
            { name: 'React Native', level: 'Advanced', description: 'Cross-platform native bridges.' },
            { name: 'Docker & Linux', level: 'Intermediate', description: 'Containerized CI/CD pipelines.' },
          ],
          learn: [
            { name: 'Structural Analysis & STAAD', targetLevel: 'Beginner', notes: 'Collaborating with IIEST Civil peers.' },
            { name: 'Deep Learning & PyTorch', targetLevel: 'Intermediate', notes: 'On-device mobile inference.' },
          ],
        },
        {
          uid: 'seed_buie_riddhi',
          email: 'riddhi.dutta@buie.internal',
          fullName: 'Riddhi Dutta',
          username: 'riddhi_buie_me',
          avatarUrl: '/src/assets/images/avatar_student_ananya_1795456800848.jpg',
          collegeId: buie.id,
          departmentId: buieMe.id,
          academicYear: '3rd Year',
          bio: 'BUIE Mechanical junior designing CAD robotic grippers and ROS2 nodes. Looking to learn Figma UI systems & DSA.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Mon', 'Thu', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 },
          githubUrl: '',
          linkedinUrl: 'https://linkedin.com/in/riddhidutta-me',
          portfolioUrl: '',
          teach: [
            { name: 'AutoCAD & SolidWorks', level: 'Advanced', description: 'Robotic end-effectors & stress assemblies.' },
            { name: 'Robotics & ROS2', level: 'Intermediate', description: 'MoveIt kinematics & actuation.' },
          ],
          learn: [
            { name: 'Figma & UI Systems', targetLevel: 'Beginner', notes: 'Designing robot control dashboards.' },
            { name: 'Data Structures & Algorithms', targetLevel: 'Beginner', notes: 'Graph search for path planning.' },
          ],
        },
        {
          uid: 'seed_buie_sujoy',
          email: 'sujoy.mitra@buie.internal',
          fullName: 'Sujoy Mitra',
          username: 'sujoy_buie_ce',
          avatarUrl: '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
          collegeId: buie.id,
          departmentId: buieCe.id,
          academicYear: '2nd Year',
          bio: 'Civil engineering sophomore at BUIE modeling steel trusses in STAAD and AutoCAD. Learning React Native & C++ problem solving.',
          experienceLevel: 'Beginner',
          preferredLanguages: ['English', 'Bengali'],
          availability: { days: ['Tue', 'Fri', 'Sat'], timeSlot: 'Afternoon (2 PM - 5 PM)', hoursPerWeek: 4 },
          githubUrl: '',
          linkedinUrl: '',
          portfolioUrl: '',
          teach: [
            { name: 'Structural Analysis & STAAD', level: 'Intermediate', description: 'Bridge truss & frame modeling.' },
            { name: 'AutoCAD & SolidWorks', level: 'Intermediate', description: 'Survey contours & 2D CAD sheets.' },
          ],
          learn: [
            { name: 'React Native', targetLevel: 'Beginner', notes: 'Building a mobile concrete mix calculator.' },
            { name: 'C++ STL', targetLevel: 'Beginner', notes: 'Engineering computation scripts.' },
          ],
        },
        {
          uid: 'seed_buie_poulomi',
          email: 'poulomi.ghosh@buie.internal',
          fullName: 'Poulomi Ghosh',
          username: 'poulomi_buie_cse',
          avatarUrl: '/src/assets/images/avatar_student_priya_1795456800427.jpg',
          collegeId: buie.id,
          departmentId: buieCse.id,
          academicYear: '2nd Year',
          bio: 'BUIE CSE sophomore passionate about accessible Figma systems, UX prototyping, and React. Exploring ESP32 hardware & ML.',
          experienceLevel: 'Intermediate',
          preferredLanguages: ['English', 'Bengali', 'Hindi'],
          availability: { days: ['Mon', 'Wed', 'Sun'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 6 },
          githubUrl: 'https://github.com/poulomi-ui',
          linkedinUrl: 'https://linkedin.com/in/poulomighosh',
          portfolioUrl: '',
          teach: [
            { name: 'Figma & UI Systems', level: 'Advanced', description: 'Accessible color contrast & component variants.' },
            { name: 'UI/UX & Product Prototyping', level: 'Advanced', description: 'Wireframing & usability reviews.' },
            { name: 'React & TypeScript', level: 'Intermediate', description: 'Reusable React UI primitives.' },
          ],
          learn: [
            { name: 'Embedded C & ESP32', targetLevel: 'Beginner', notes: 'Connecting hardware wearables to web UIs.' },
            { name: 'Machine Learning', targetLevel: 'Beginner', notes: 'Personalization & recommendation basics.' },
          ],
        },
      ];

      for (const s of studentSeeds) {
        const existingProfile = await db
          .select()
          .from(profiles)
          .where(eq(profiles.uid, s.uid))
          .limit(1);

        let profileRow = existingProfile[0];
        if (!profileRow) {
          const [inserted] = await db
            .insert(profiles)
            .values({
              uid: s.uid,
              email: s.email,
              fullName: s.fullName,
              username: s.username,
              avatarUrl: s.avatarUrl,
              collegeId: s.collegeId,
              departmentId: s.departmentId,
              academicYear: s.academicYear,
              bio: s.bio,
              experienceLevel: s.experienceLevel,
              preferredLanguages: s.preferredLanguages,
              availability: s.availability,
              githubUrl: s.githubUrl,
              linkedinUrl: s.linkedinUrl,
              portfolioUrl: s.portfolioUrl,
              onboardingCompleted: true,
              role: 'student',
            })
            .onConflictDoNothing()
            .returning();
          profileRow = inserted;
        }

        if (!profileRow) continue;

        for (const t of s.teach) {
          const sk = skillByName.get(t.name);
          if (sk) {
            await db
              .insert(userTeachingSkills)
              .values({
                profileId: profileRow.id,
                skillId: sk.id,
                level: t.level,
                description: t.description,
              })
              .onConflictDoNothing();
          }
        }
        for (const l of s.learn) {
          const sk = skillByName.get(l.name);
          if (sk) {
            await db
              .insert(userLearningSkills)
              .values({
                profileId: profileRow.id,
                skillId: sk.id,
                targetLevel: l.targetLevel,
                notes: l.notes,
              })
              .onConflictDoNothing();
          }
        }
      }

      // 5. Ensure Communities (including Mechanical & Civil)
      const [arjun] = await db.select().from(profiles).where(eq(profiles.uid, 'seed_buie_arjun')).limit(1);
      const [priya] = await db.select().from(profiles).where(eq(profiles.uid, 'seed_buie_priya')).limit(1);
      const [rohan] = await db.select().from(profiles).where(eq(profiles.uid, 'seed_buie_rohan')).limit(1);
      const [ananya] = await db.select().from(profiles).where(eq(profiles.uid, 'seed_buie_ananya')).limit(1);
      const [megha] = await db.select().from(profiles).where(eq(profiles.uid, 'seed_buie_megha')).limit(1);
      const [sayantan] = await db.select().from(profiles).where(eq(profiles.uid, 'seed_buie_sayantan')).limit(1);

      const communityDefs = [
        {
          collegeId: buie.id,
          departmentId: buieCse.id,
          name: 'BUIE Computer Science & Engineering Hub',
          slug: 'buie-cse-hub',
          description: 'Official peer-exchange circle for BUIE CSE students covering DSA, full-stack systems, and hackathon prep.',
        },
        {
          collegeId: buie.id,
          departmentId: buieEce.id,
          name: 'BUIE Embedded & Hardware Lab',
          slug: 'buie-ece-hardware',
          description: 'Share ESP32 schematics, VLSI testbenches, and find software partners for hardware prototypes.',
        },
        {
          collegeId: null,
          departmentId: null,
          name: 'West Bengal Inter-College AI Guild',
          slug: 'wb-intercollege-ai',
          description: 'Cross-campus collaboration between BUIE, JU, NIT Durgapur, and IIEST students building applied ML & RAG apps.',
        },
        {
          collegeId: buie.id,
          departmentId: buieIt.id,
          name: 'BUIE Product Design & Frontend Studio',
          slug: 'buie-design-frontend',
          description: 'Weekly UI critiques, Figma component swaps, and React TypeScript pairing.',
        },
        {
          collegeId: buie.id,
          departmentId: buieMe.id,
          name: 'BUIE Core Engineering (ME & CE) Guild',
          slug: 'buie-core-me-ce',
          description: 'CAD modeling, ROS2 robotics, STAAD structural analysis, and interdisciplinary software-hardware builds.',
        },
      ];

      for (const comm of communityDefs) {
        await db.insert(communities).values(comm).onConflictDoNothing();
      }

      const existingPosts = await db.select().from(communityPosts).limit(1);
      if (existingPosts.length === 0 && arjun && priya && rohan && ananya) {
        const allComms = await db.select().from(communities);
        const commBySlug = new Map(allComms.map((c) => [c.slug, c]));

        const cseComm = commBySlug.get('buie-cse-hub');
        const eceComm = commBySlug.get('buie-ece-hardware');
        const aiComm = commBySlug.get('wb-intercollege-ai');
        const uiComm = commBySlug.get('buie-design-frontend');
        const coreComm = commBySlug.get('buie-core-me-ce');

        if (cseComm) {
          await db.insert(communityMembers).values({ communityId: cseComm.id, profileId: arjun.id, role: 'moderator' }).onConflictDoNothing();
          await db.insert(communityMembers).values({ communityId: cseComm.id, profileId: ananya.id, role: 'member' }).onConflictDoNothing();
          await db.insert(communityPosts).values({
            communityId: cseComm.id,
            authorId: arjun.id,
            title: 'Weekend PostgreSQL + Drizzle Indexing Workshop at BUIE Lab 3',
            content: 'Running a 90-minute peer walkthrough on relational schema design and query optimization this Saturday at 6 PM. Bring your semester project schemas!',
            postType: 'study_partner',
            resourceUrl: '',
          });
        }
        if (eceComm) {
          await db.insert(communityMembers).values({ communityId: eceComm.id, profileId: rohan.id, role: 'moderator' }).onConflictDoNothing();
          await db.insert(communityPosts).values({
            communityId: eceComm.id,
            authorId: rohan.id,
            title: 'Need a Backend Partner for ESP32 Campus Weather Node',
            content: 'Hardware PCB and MQTT firmware are ready. Looking for someone comfortable with Node.js WebSockets to stream live readings.',
            postType: 'study_partner',
            resourceUrl: '',
          });
        }
        if (aiComm) {
          await db.insert(communityMembers).values({ communityId: aiComm.id, profileId: priya.id, role: 'moderator' }).onConflictDoNothing();
          await db.insert(communityPosts).values({
            communityId: aiComm.id,
            authorId: priya.id,
            title: 'Curated PyTorch & Structured LLM Evaluation Notes',
            content: 'Compiled a clean checklist for evaluating RAG retrieval precision without leaking PII into prompts. Looking for a React peer to help visualize the metrics.',
            postType: 'resource',
            resourceUrl: 'https://pytorch.org/tutorials/',
          });
        }
        if (uiComm) {
          await db.insert(communityMembers).values({ communityId: uiComm.id, profileId: ananya.id, role: 'moderator' }).onConflictDoNothing();
        }
        if (coreComm && megha && sayantan) {
          await db.insert(communityMembers).values({ communityId: coreComm.id, profileId: megha.id, role: 'moderator' }).onConflictDoNothing();
          await db.insert(communityMembers).values({ communityId: coreComm.id, profileId: sayantan.id, role: 'member' }).onConflictDoNothing();
          await db.insert(communityPosts).values({
            communityId: coreComm.id,
            authorId: megha.id,
            title: 'SolidWorks + ROS2 Rover Chassis CAD Files & Software Co-Pilots',
            content: 'Uploaded our 4-wheel rocker-bogie CAD assembly. Looking for CSE/IT students who want to learn ROS2 kinematics while helping us build the telemetry UI.',
            postType: 'study_partner',
            resourceUrl: '',
          });
        }
      }

      // 6. Ensure Projects
      const existingProjects = await db.select().from(projects).limit(1);
      if (existingProjects.length === 0 && arjun && priya && rohan && ananya) {
        const insertedProjects = await db
          .insert(projects)
          .values([
            {
              ownerId: arjun.id,
              collegeId: buie.id,
              title: 'BUIE Smart Campus Transit & Bus Tracker',
              description: 'Real-time shuttle and bus arrival map for Bankura commuters with crowdsourced delay alerts and offline timetable cache.',
              requiredSkills: ['React & TypeScript', 'Node.js & Express', 'Embedded C & ESP32'],
              status: 'recruiting',
              maxMembers: 4,
            },
            {
              ownerId: priya.id,
              collegeId: buie.id,
              title: 'PeerLab: Collaborative Exam & Lab Paper Analyzer',
              description: 'Open-source academic study tool helping engineering students map syllabus topics to past question trends and peer tutors.',
              requiredSkills: ['Python & FastAPI', 'Machine Learning', 'Figma & UI Systems'],
              status: 'recruiting',
              maxMembers: 5,
            },
            {
              ownerId: rohan.id,
              collegeId: buie.id,
              title: 'Low-Cost Lab Oscilloscope Telemetry Bridge',
              description: 'Streaming microcontroller ADC waveforms over WebSockets to a browser-based oscilloscope canvas for 1st-year lab students.',
              requiredSkills: ['Embedded C & ESP32', 'React & TypeScript', 'Tailwind CSS'],
              status: 'active',
              maxMembers: 3,
            },
          ])
          .returning();

        await db.insert(projectMembers).values([
          { projectId: insertedProjects[0].id, profileId: arjun.id, role: 'Project Lead', status: 'accepted', motivation: 'Founder' },
          { projectId: insertedProjects[0].id, profileId: ananya.id, role: 'UI Engineer', status: 'accepted', motivation: 'Designing mobile transit map' },
          { projectId: insertedProjects[1].id, profileId: priya.id, role: 'ML Lead', status: 'accepted', motivation: 'Founder' },
          { projectId: insertedProjects[2].id, profileId: rohan.id, role: 'Firmware Lead', status: 'accepted', motivation: 'Founder' },
        ]);
      }
    } catch (error) {
      console.error('Seed error:', error);
      seedPromise = null;
    }
  })();

  return seedPromise;
}
