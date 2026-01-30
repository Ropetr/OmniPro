import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { User } from './User';
import { Department } from './Department';

@Entity('user_departments')
@Unique(['userId', 'departmentId'])
export class UserDepartment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  departmentId: string;

  @ManyToOne(() => Department, (dept) => dept.members)
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ type: 'jsonb', nullable: true })
  skills: string[]; // e.g. ['vendas', 'técnico', 'financeiro', 'inglês']

  @Column({ type: 'int', default: 5 })
  skillLevel: number; // 1-10, higher = more experienced

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
