-- ============================================================
-- Update programs table with ministry & leadership descriptions
-- Run this in Supabase SQL Editor
-- ============================================================

UPDATE public.programs SET
  title          = 'Certificate in Kingdom Business Administration',
  title_fr       = 'Certificat en Administration des Affaires du Royaume',
  short_desc     = 'Foundational ministry and business skills grounded in biblical principles of stewardship, communication and kingdom enterprise.',
  short_desc_fr  = 'Compétences fondamentales en ministère et en affaires, ancrées dans les principes bibliques d''intendance et d''entreprise du Royaume.',
  description    = 'This programme provides students with a solid foundation in kingdom-centred business disciplines — financial stewardship, ministerial communication, and the biblical foundations of enterprise. Designed for church leaders, ministry workers and faith-driven entrepreneurs who want to operate with excellence and integrity.',
  description_fr = 'Ce programme offre une base solide dans les disciplines commerciales centrées sur le Royaume — intendance financière, communication ministérielle et fondements bibliques de l''entreprise.'
WHERE id = '11111111-0000-0000-0000-000000000001';

UPDATE public.programs SET
  title          = 'Certificate in Ministry Human Resource Management',
  title_fr       = 'Certificat en Gestion des Ressources Humaines Ministérielles',
  short_desc     = 'Practical people-management skills for ministry contexts — volunteer coordination, pastoral care structures and biblical leadership of teams.',
  short_desc_fr  = 'Compétences pratiques en gestion des personnes pour les contextes ministériels — coordination des bénévoles et leadership biblique.',
  description    = 'Designed for ministry leaders responsible for managing people — both paid staff and volunteers. Covers biblical team building, pastoral HR frameworks, conflict resolution, disciplinary procedures and leadership of church and NGO teams within the West African legal and cultural context.',
  description_fr = 'Conçu pour les leaders ministériels responsables de la gestion des personnes — personnel salarié et bénévoles.'
WHERE id = '11111111-0000-0000-0000-000000000002';

UPDATE public.programs SET
  title          = 'Certificate in Ministry Communications & Digital Outreach',
  title_fr       = 'Certificat en Communication Ministérielle et Évangélisation Numérique',
  short_desc     = 'Master digital and traditional communication tools to spread the Gospel, build your ministry brand and engage your congregation effectively.',
  short_desc_fr  = 'Maîtrisez les outils de communication numériques pour répandre l''Évangile et engager votre congrégation efficacement.',
  description    = 'A hands-on programme covering the full spectrum of ministry communication — social media evangelism, website management, church newsletters, video production, sermon broadcasting, and cross-cultural digital outreach. Students develop and execute a real ministry communication campaign.',
  description_fr = 'Un programme pratique couvrant l''ensemble de la communication ministérielle — évangélisation sur les réseaux sociaux, gestion de site web et diffusion de sermons.'
WHERE id = '11111111-0000-0000-0000-000000000003';

UPDATE public.programs SET
  title          = 'Diploma in Ministry Leadership & Management',
  title_fr       = 'Diplôme en Leadership Ministériel et Management',
  short_desc     = 'Comprehensive leadership education for ministry managers — servant leadership, kingdom strategy, operations and team development.',
  short_desc_fr  = 'Formation complète en leadership pour les managers ministériels — leadership serviteur, stratégie du Royaume et développement d''équipe.',
  description    = 'Our flagship diploma develops well-rounded ministry managers capable of leading teams, managing operations and driving kingdom strategy. The curriculum spans servant leadership, operational administration of ministry organisations, fundraising, donor relations and financial stewardship.',
  description_fr = 'Notre diplôme phare développe des managers ministériels complets capables de diriger des équipes et de piloter la stratégie du Royaume.'
WHERE id = '11111111-0000-0000-0000-000000000004';

UPDATE public.programs SET
  title          = 'Diploma in Ministry Finance & Stewardship',
  title_fr       = 'Diplôme en Finance Ministérielle et Intendance',
  short_desc     = 'Biblical financial management, accountability, reporting and stewardship principles for church and faith-based organisations.',
  short_desc_fr  = 'Gestion financière biblique, responsabilité et principes d''intendance pour les églises et organisations confessionnelles.',
  description    = 'Prepares ministry leaders for professional financial oversight of churches and faith-based organisations. Topics include biblical stewardship, financial reporting, donor fund management, budgeting, audit preparation and compliance — with practical application to African ministry contexts.',
  description_fr = 'Prépare les leaders ministériels à la supervision financière professionnelle des églises et des organisations confessionnelles.'
WHERE id = '11111111-0000-0000-0000-000000000005';

UPDATE public.programs SET
  title          = 'Diploma in Ministry Project Management',
  title_fr       = 'Diplôme en Gestion de Projets Ministériels',
  short_desc     = 'Plan, execute and close ministry projects — building projects, outreach campaigns, community development and church planting initiatives.',
  short_desc_fr  = 'Planifiez, exécutez et clôturez des projets ministériels — campagnes d''évangélisation, développement communautaire et implantation d''église.',
  description    = 'Aligned with PMI standards and adapted for ministry contexts, this diploma equips students to manage complex kingdom projects on time and within budget. Covers Agile and traditional methodologies applied to church building programmes, mission outreaches, community development and multi-site ministry expansion.',
  description_fr = 'Aligné sur les normes PMI et adapté aux contextes ministériels, ce diplôme équipe les étudiants pour gérer des projets du Royaume complexes.'
WHERE id = '11111111-0000-0000-0000-000000000006';

UPDATE public.programs SET
  title          = 'Diploma in Church Planting & Ministry Expansion',
  title_fr       = 'Diplôme en Implantation d''Église et Expansion Ministérielle',
  short_desc     = 'Strategic and operational frameworks for planting churches, establishing ministry outposts and expanding kingdom influence across territories.',
  short_desc_fr  = 'Cadres stratégiques pour implanter des églises et étendre l''influence du Royaume à travers les territoires.',
  description    = 'Covers every dimension of church planting and ministry expansion — from initial vision and site selection through to governance, community integration, and sustaining growth. Students develop a full church planting proposal as their capstone project, grounded in cross-cultural mission principles.',
  description_fr = 'Couvre chaque dimension de l''implantation d''église — de la vision initiale à la gouvernance et à la croissance durable.'
WHERE id = '11111111-0000-0000-0000-000000000007';

UPDATE public.programs SET
  title          = 'Advanced Diploma in Apostolic Business Administration',
  title_fr       = 'Diplôme Avancé en Administration Apostolique des Affaires',
  short_desc     = 'The highest-level qualification at LWGSM — strategic governance, global ministry expansion, ethics and executive leadership for seasoned ministers.',
  short_desc_fr  = 'La qualification la plus élevée à LWGSM — gouvernance stratégique, expansion ministérielle mondiale et leadership exécutif pour ministres expérimentés.',
  description    = 'Designed for experienced ministry leaders and marketplace apostles seeking to operate at executive level. Modules include corporate governance for faith-based organisations, global ministry expansion strategy, kingdom entrepreneurship, ethics, accountability, and a capstone consulting project for a real ministry or faith-based enterprise.',
  description_fr = 'Conçu pour les leaders ministériels expérimentés et les apôtres du marché visant un niveau exécutif.'
WHERE id = '11111111-0000-0000-0000-000000000008';

UPDATE public.programs SET
  title          = 'Advanced Diploma in Kingdom Financial Management',
  title_fr       = 'Diplôme Avancé en Gestion Financière du Royaume',
  short_desc     = 'Advanced financial leadership for senior ministry executives — investment strategy, endowment management, risk and kingdom wealth principles.',
  short_desc_fr  = 'Leadership financier avancé pour les cadres ministériels seniors — stratégie d''investissement, gestion de dotation et principes de richesse du Royaume.',
  description    = 'A rigorous programme for ministry finance directors and kingdom investors targeting senior roles. Topics include faith-based investment principles, endowment fund management, risk and treasury for ministries, mergers of ministry organisations, and ESG-aligned reporting for faith-based entities.',
  description_fr = 'Un programme rigoureux pour les directeurs financiers ministériels et les investisseurs du Royaume ciblant des rôles seniors.'
WHERE id = '11111111-0000-0000-0000-000000000009';

UPDATE public.programs SET
  title          = 'Advanced Diploma in Next-Generation Leadership & Discipleship',
  title_fr       = 'Diplôme Avancé en Leadership de la Prochaine Génération et Disciples',
  short_desc     = 'Raise, mentor and release the next generation of kingdom leaders through proven discipleship, mentorship and succession frameworks.',
  short_desc_fr  = 'Formez, mentoriez et libérez la prochaine génération de leaders du Royaume grâce à des cadres éprouvés de mentorat et de succession.',
  description    = 'Built for senior pastors, apostolic fathers and organisational leaders committed to raising the next generation. Covers structured mentorship programmes, leadership pipelines, succession planning, coaching frameworks, and creating cultures of empowerment and accountability in ministry and marketplace contexts.',
  description_fr = 'Conçu pour les pasteurs seniors et les pères apostoliques engagés à former la prochaine génération de leaders.'
WHERE id = '11111111-0000-0000-0000-000000000010';

-- Verify
SELECT id, title, type FROM public.programs ORDER BY type, title;
