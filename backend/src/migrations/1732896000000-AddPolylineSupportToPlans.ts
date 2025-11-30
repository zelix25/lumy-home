import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPolylineSupportToPlans1732896000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Note: Cette migration est principalement documentaire
    // Les rooms sont stockées dans une colonne JSON, donc le schéma de la table ne change pas
    // Les nouvelles propriétés 'points' et 'isPolyline' sont automatiquement supportées par JSON
    
    // Vérifier si la table plans existe
    const table = await queryRunner.getTable('plans');
    if (!table) {
      // Si la table n'existe pas, elle sera créée automatiquement par synchronize
      return;
    }

    // La colonne rooms est déjà de type JSON, donc aucune modification n'est nécessaire
    // Les données JSON peuvent stocker n'importe quelle structure sans migration de schéma
    console.log('Migration AddPolylineSupportToPlans: Aucune modification de schéma nécessaire (données JSON)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Pas de rollback nécessaire car aucune modification de schéma n'a été effectuée
    console.log('Migration AddPolylineSupportToPlans: Rollback - Aucune action nécessaire');
  }
}

